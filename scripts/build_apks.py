#!/usr/bin/env python3
"""
Builds two standalone, V1 + V2 signed Android APK packages:
1. public/apk/ravi-citizen.apk (ir.faraja.ravi.citizen) -> Citizen Reporting App (/)
2. public/apk/ravi-admin.apk   (ir.faraja.ravi.admin)   -> Standalone Admin Panel (/admin)
Also packages the complete Android Studio Gradle source projects for both apps.
"""
import os
import sys
import zlib
import struct
import hashlib
import zipfile
import subprocess
import tempfile

SHARED_BASE_URL = os.environ.get(
    "APP_URL",
    "https://ais-pre-yoap3bi3zzwnamuxuwknfg-265318863370.us-west2.run.app"
).rstrip("/")


def encode_utf16le_string(s: str) -> bytes:
    u16 = s.encode("utf-16le")
    char_len = len(s)
    return struct.pack("<H", char_len) + u16 + b"\x00\x00"


def build_axml_manifest(package_name: str, app_label: str, version_code: int = 1, version_name: str = "1.0.0") -> bytes:
    """
    Constructs a valid binary AndroidManifest.xml (AXML) with:
    - package, versionCode, versionName
    - uses-sdk (minSdkVersion=21, targetSdkVersion=33)
    - uses-permission: android.permission.INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS
    - application (android:label, android:usesCleartextTraffic=true)
      - activity (.MainActivity, android:exported=true, configChanges)
        - intent-filter (MAIN / LAUNCHER)
    """
    # Resource IDs in android.* namespace (must be sorted in the resource ID table or matched by index)
    # 0x01010001: label
    # 0x01010003: name
    # 0x01010010: exported
    # 0x0101001f: configChanges
    # 0x0101020c: minSdkVersion
    # 0x0101021b: versionCode
    # 0x0101021c: versionName
    # 0x01010270: targetSdkVersion
    # 0x010104ec: usesCleartextTraffic
    res_strings_with_ids = [
        ("label", 0x01010001),
        ("name", 0x01010003),
        ("exported", 0x01010010),
        ("configChanges", 0x0101001f),
        ("minSdkVersion", 0x0101020c),
        ("versionCode", 0x0101021b),
        ("versionName", 0x0101021c),
        ("targetSdkVersion", 0x01010270),
        ("usesCleartextTraffic", 0x010104ec),
    ]

    other_strings = [
        "http://schemas.android.com/apk/res/android",
        "android",
        "manifest",
        "package",
        package_name,
        version_name,
        "uses-sdk",
        "uses-permission",
        "android.permission.INTERNET",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "application",
        app_label,
        "activity",
        f"{package_name}.MainActivity",
        "intent-filter",
        "action",
        "android.intent.action.MAIN",
        "category",
        "android.intent.category.LAUNCHER",
    ]

    all_strings = [s for s, _ in res_strings_with_ids] + other_strings
    str_idx = {s: i for i, s in enumerate(all_strings)}

    # 1. String Pool Chunk (0x0001)
    encoded_strs = [encode_utf16le_string(s) for s in all_strings]
    offsets = []
    cur_off = 0
    for es in encoded_strs:
        offsets.append(cur_off)
        cur_off += len(es)
    str_data = b"".join(encoded_strs)
    while len(str_data) % 4 != 0:
        str_data += b"\x00"

    string_count = len(all_strings)
    strings_start = 28 + string_count * 4
    sp_chunk_size = strings_start + len(str_data)
    sp_header = struct.pack(
        "<HHIIIIII",
        0x0001,          # RES_STRING_POOL_TYPE
        28,              # headerSize
        sp_chunk_size,   # chunkSize
        string_count,
        0,               # styleCount
        0,               # flags (UTF-16)
        strings_start,
        0                # stylesStart
    )
    sp_offsets = b"".join(struct.pack("<I", o) for o in offsets)
    sp_chunk = sp_header + sp_offsets + str_data

    # 2. Resource Map Chunk (0x0180)
    res_ids = [rid for _, rid in res_strings_with_ids]
    rm_chunk_size = 8 + len(res_ids) * 4
    rm_chunk = struct.pack("<HHI", 0x0180, 8, rm_chunk_size) + b"".join(
        struct.pack("<I", r) for r in res_ids
    )

    NS_URI = str_idx["http://schemas.android.com/apk/res/android"]
    NS_PREFIX = str_idx["android"]
    NO_STR = 0xFFFFFFFF

    def make_start_ns(line: int) -> bytes:
        return struct.pack("<HHIIIII", 0x0100, 16, 24, line, NO_STR, NS_PREFIX, NS_URI)

    def make_end_ns(line: int) -> bytes:
        return struct.pack("<HHIIIII", 0x0101, 16, 24, line, NO_STR, NS_PREFIX, NS_URI)

    def make_attr_str(ns: int, name_s: str, val_s: str) -> bytes:
        vi = str_idx[val_s]
        # RES_VALUE: size=8, res0=0, dataType=0x03 (TYPE_STRING), data=vi
        return struct.pack("<IIIHBBI", ns, str_idx[name_s], vi, 8, 0, 0x03, vi)

    def make_attr_int(ns: int, name_s: str, val: int) -> bytes:
        # dataType=0x10 (TYPE_INT_DEC)
        return struct.pack("<IIIHBBI", ns, str_idx[name_s], NO_STR, 8, 0, 0x10, val)

    def make_attr_bool(ns: int, name_s: str, val: bool) -> bytes:
        # dataType=0x12 (TYPE_INT_BOOLEAN)
        return struct.pack("<IIIHBBI", ns, str_idx[name_s], NO_STR, 8, 0, 0x12, 0xFFFFFFFF if val else 0)

    def make_start_el(line: int, name_s: str, attrs: list) -> bytes:
        chunk_size = 36 + len(attrs) * 20
        hdr = struct.pack(
            "<HHIIIIIHHHHHH",
            0x0102,              # RES_XML_START_ELEMENT_TYPE
            16,                  # headerSize
            chunk_size,
            line,
            NO_STR,              # comment
            NO_STR,              # ns
            str_idx[name_s],
            20,                  # attributeStart
            20,                  # attributeSize
            len(attrs),          # attributeCount
            0,                   # idIndex
            0,                   # classIndex
            0                    # styleIndex
        )
        return hdr + b"".join(attrs)

    def make_end_el(line: int, name_s: str) -> bytes:
        return struct.pack("<HHIIIII", 0x0103, 16, 24, line, NO_STR, NO_STR, str_idx[name_s])

    xml_nodes = []
    xml_nodes.append(make_start_ns(2))

    # <manifest package="..." android:versionCode="1" android:versionName="1.0.0">
    xml_nodes.append(
        make_start_el(
            2,
            "manifest",
            [
                make_attr_int(NS_URI, "versionCode", version_code),
                make_attr_str(NS_URI, "versionName", version_name),
                make_attr_str(NO_STR, "package", package_name),
            ],
        )
    )

    # <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="33" />
    xml_nodes.append(
        make_start_el(
            4,
            "uses-sdk",
            [
                make_attr_int(NS_URI, "minSdkVersion", 21),
                make_attr_int(NS_URI, "targetSdkVersion", 33),
            ],
        )
    )
    xml_nodes.append(make_end_el(4, "uses-sdk"))

    # Permissions
    for perm in [
        "android.permission.INTERNET",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
    ]:
        xml_nodes.append(
            make_start_el(6, "uses-permission", [make_attr_str(NS_URI, "name", perm)])
        )
        xml_nodes.append(make_end_el(6, "uses-permission"))

    # <application android:label="..." android:usesCleartextTraffic="true">
    xml_nodes.append(
        make_start_el(
            10,
            "application",
            [
                make_attr_str(NS_URI, "label", app_label),
                make_attr_bool(NS_URI, "usesCleartextTraffic", True),
            ],
        )
    )

    # <activity android:name="..." android:exported="true" android:configChanges="0x04a0">
    xml_nodes.append(
        make_start_el(
            12,
            "activity",
            [
                make_attr_str(NS_URI, "name", f"{package_name}.MainActivity"),
                make_attr_bool(NS_URI, "exported", True),
                make_attr_int(NS_URI, "configChanges", 0x04A0),
            ],
        )
    )

    # <intent-filter>
    xml_nodes.append(make_start_el(14, "intent-filter", []))
    xml_nodes.append(
        make_start_el(15, "action", [make_attr_str(NS_URI, "name", "android.intent.action.MAIN")])
    )
    xml_nodes.append(make_end_el(15, "action"))
    xml_nodes.append(
        make_start_el(
            16, "category", [make_attr_str(NS_URI, "name", "android.intent.category.LAUNCHER")]
        )
    )
    xml_nodes.append(make_end_el(16, "category"))
    xml_nodes.append(make_end_el(17, "intent-filter"))

    xml_nodes.append(make_end_el(18, "activity"))
    xml_nodes.append(make_end_el(19, "application"))
    xml_nodes.append(make_end_el(20, "manifest"))
    xml_nodes.append(make_end_ns(20))

    body = sp_chunk + rm_chunk + b"".join(xml_nodes)
    total_size = 8 + len(body)
    file_header = struct.pack("<HHI", 0x0003, 8, total_size)
    return file_header + body


def uleb128(value: int) -> bytes:
    out = bytearray()
    while True:
        b = value & 0x7F
        value >>= 7
        if value != 0:
            out.append(b | 0x80)
        else:
            out.append(b)
            break
    return bytes(out)


def build_webview_dex(package_name: str, target_url: str) -> bytes:
    """
    Constructs a valid Dalvik Executable (classes.dex) containing:
    class <package_name>.MainActivity extends android.app.Activity {
        public MainActivity() { super(); }
        protected void onCreate(android.os.Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            android.webkit.WebView wv = new android.webkit.WebView(this);
            android.webkit.WebSettings ws = wv.getSettings();
            ws.setJavaScriptEnabled(true);
            ws.setDomStorageEnabled(true);
            wv.setWebViewClient(new android.webkit.WebViewClient());
            wv.setWebChromeClient(new android.webkit.WebChromeClient());
            this.setContentView(wv);
            wv.loadUrl(target_url);
        }
    }
    """
    cls_desc = f"L{package_name.replace('.', '/')}/MainActivity;"

    # Strings in strict lexicographical UTF-16 order (required by DEX specification!)
    raw_strings = sorted(
        set(
            [
                "<init>",
                "L",
                "Landroid/app/Activity;",
                "Landroid/content/Context;",
                "Landroid/os/Bundle;",
                "Landroid/view/View;",
                "Landroid/webkit/WebChromeClient;",
                "Landroid/webkit/WebSettings;",
                "Landroid/webkit/WebView;",
                "Landroid/webkit/WebViewClient;",
                "Ljava/lang/String;",
                " MainActivity.java",
                "V",
                "VL",
                "VZ",
                "Z",
                cls_desc,
                "getSettings",
                "loadUrl",
                "onCreate",
                "setAllowFileAccess",
                "setAllowFileAccessFromFileURLs",
                "setAllowUniversalAccessFromFileURLs",
                "setContentView",
                "setDomStorageEnabled",
                "setJavaScriptEnabled",
                "setWebChromeClient",
                "setWebViewClient",
                target_url,
            ]
        )
    )
    s_idx = {s: i for i, s in enumerate(raw_strings)}

    # Types sorted by string_idx
    raw_types = sorted(
        [
            "Landroid/app/Activity;",
            "Landroid/content/Context;",
            "Landroid/os/Bundle;",
            "Landroid/view/View;",
            "Landroid/webkit/WebChromeClient;",
            "Landroid/webkit/WebSettings;",
            "Landroid/webkit/WebView;",
            "Landroid/webkit/WebViewClient;",
            "Ljava/lang/String;",
            "V",
            "Z",
            cls_desc,
        ],
        key=lambda t: s_idx[t],
    )
    t_idx = {t: i for i, t in enumerate(raw_types)}

    # Protos: (shorty_str, return_type_str, param_types_tuple)
    raw_protos = [
        ("L", "Landroid/webkit/WebSettings;", ()),
        ("V", "V", ()),
        ("VL", "V", ("Landroid/content/Context;",)),
        ("VL", "V", ("Landroid/os/Bundle;",)),
        ("VL", "V", ("Landroid/view/View;",)),
        ("VL", "V", ("Landroid/webkit/WebChromeClient;",)),
        ("VL", "V", ("Landroid/webkit/WebViewClient;",)),
        ("VL", "V", ("Ljava/lang/String;",)),
        ("VZ", "V", ("Z",)),
    ]
    raw_protos.sort(
        key=lambda p: (t_idx[p[1]], tuple(t_idx[x] for x in p[2]))
    )
    p_idx = {(p[1], p[2]): i for i, p in enumerate(raw_protos)}

    # Methods: (class_type_str, proto_key, name_str)
    raw_methods = [
        ("Landroid/app/Activity;", ("V", ()), "<init>"),
        ("Landroid/app/Activity;", ("V", ("Landroid/os/Bundle;",)), "onCreate"),
        ("Landroid/app/Activity;", ("V", ("Landroid/view/View;",)), "setContentView"),
        ("Landroid/webkit/WebChromeClient;", ("V", ()), "<init>"),
        ("Landroid/webkit/WebSettings;", ("V", ("Z",)), "setAllowFileAccess"),
        ("Landroid/webkit/WebSettings;", ("V", ("Z",)), "setAllowFileAccessFromFileURLs"),
        ("Landroid/webkit/WebSettings;", ("V", ("Z",)), "setAllowUniversalAccessFromFileURLs"),
        ("Landroid/webkit/WebSettings;", ("V", ("Z",)), "setDomStorageEnabled"),
        ("Landroid/webkit/WebSettings;", ("V", ("Z",)), "setJavaScriptEnabled"),
        ("Landroid/webkit/WebView;", ("V", ("Landroid/content/Context;",)), "<init>"),
        ("Landroid/webkit/WebView;", ("Landroid/webkit/WebSettings;", ()), "getSettings"),
        ("Landroid/webkit/WebView;", ("V", ("Ljava/lang/String;",)), "loadUrl"),
        ("Landroid/webkit/WebView;", ("V", ("Landroid/webkit/WebChromeClient;",)), "setWebChromeClient"),
        ("Landroid/webkit/WebView;", ("V", ("Landroid/webkit/WebViewClient;",)), "setWebViewClient"),
        ("Landroid/webkit/WebViewClient;", ("V", ()), "<init>"),
        (cls_desc, ("V", ()), "<init>"),
        (cls_desc, ("V", ("Landroid/os/Bundle;",)), "onCreate"),
    ]
    raw_methods.sort(
        key=lambda m: (t_idx[m[0]], s_idx[m[2]], p_idx[m[1]])
    )
    m_idx = {(m[0], m[2], m[1]): i for i, m in enumerate(raw_methods)}

    # Build code_item for <init>()V:
    # invoke-direct {p0}, Landroid/app/Activity;-><init>()V  (7010 <m_id> 0000)
    # return-void (0e00)
    m_act_init = m_idx[("Landroid/app/Activity;", "<init>", ("V", ()))]
    init_insns = struct.pack("<HHHH", 0x1070, m_act_init, 0x0000, 0x000E)
    code_init = struct.pack("<HHHHII", 1, 1, 1, 0, 0, len(init_insns) // 2) + init_insns

    # Build code_item for onCreate(Bundle)V:
    # registers: v0 (wv), v1 (ws/client), v2 (bool/url), p0=v3 (this), p1=v4 (bundle) -> registers_size=5, ins_size=2, outs_size=2
    m_super_oncreate = m_idx[("Landroid/app/Activity;", "onCreate", ("V", ("Landroid/os/Bundle;",)))]
    m_wv_init = m_idx[("Landroid/webkit/WebView;", "<init>", ("V", ("Landroid/content/Context;",)))]
    m_wv_settings = m_idx[("Landroid/webkit/WebView;", "getSettings", ("Landroid/webkit/WebSettings;", ()))]
    m_ws_js = m_idx[("Landroid/webkit/WebSettings;", "setJavaScriptEnabled", ("V", ("Z",)))]
    m_ws_dom = m_idx[("Landroid/webkit/WebSettings;", "setDomStorageEnabled", ("V", ("Z",)))]
    m_ws_file = m_idx[("Landroid/webkit/WebSettings;", "setAllowFileAccess", ("V", ("Z",)))]
    m_ws_file_urls = m_idx[("Landroid/webkit/WebSettings;", "setAllowFileAccessFromFileURLs", ("V", ("Z",)))]
    m_ws_univ_urls = m_idx[("Landroid/webkit/WebSettings;", "setAllowUniversalAccessFromFileURLs", ("V", ("Z",)))]
    m_wvc_init = m_idx[("Landroid/webkit/WebViewClient;", "<init>", ("V", ()))]
    m_wv_set_wvc = m_idx[("Landroid/webkit/WebView;", "setWebViewClient", ("V", ("Landroid/webkit/WebViewClient;",)))]
    m_wcc_init = m_idx[("Landroid/webkit/WebChromeClient;", "<init>", ("V", ()))]
    m_wv_set_wcc = m_idx[("Landroid/webkit/WebView;", "setWebChromeClient", ("V", ("Landroid/webkit/WebChromeClient;",)))]
    m_set_content = m_idx[("Landroid/app/Activity;", "setContentView", ("V", ("Landroid/view/View;",)))]
    m_wv_load = m_idx[("Landroid/webkit/WebView;", "loadUrl", ("V", ("Ljava/lang/String;",)))]

    insns = bytearray()
    # 1. invoke-super {v3, v4}, Activity.onCreate(Bundle) -> 6f20 <m> 0043
    insns += struct.pack("<HHH", 0x206F, m_super_oncreate, 0x0043)
    # 2. new-instance v0, WebView -> 2200 <type>
    insns += struct.pack("<HH", 0x0022, t_idx["Landroid/webkit/WebView;"])
    # 3. invoke-direct {v0, v3}, WebView.<init>(Context) -> 7020 <m> 0030
    insns += struct.pack("<HHH", 0x2070, m_wv_init, 0x0030)
    # 4. invoke-virtual {v0}, WebView.getSettings() -> 6e10 <m> 0000
    insns += struct.pack("<HHH", 0x106E, m_wv_settings, 0x0000)
    # 5. move-result-object v1 -> 0c01
    insns += struct.pack("<H", 0x010C)
    # 6. const/4 v2, 1 -> 1212
    insns += struct.pack("<H", 0x1212)
    # 7. invoke-virtual {v1, v2}, WebSettings.setJavaScriptEnabled(Z) -> 6e20 <m> 0021
    insns += struct.pack("<HHH", 0x206E, m_ws_js, 0x0021)
    # 8. invoke-virtual {v1, v2}, WebSettings.setDomStorageEnabled(Z) -> 6e20 <m> 0021
    insns += struct.pack("<HHH", 0x206E, m_ws_dom, 0x0021)
    # 9. invoke-virtual {v1, v2}, WebSettings.setAllowFileAccess(Z) -> 6e20 <m> 0021
    insns += struct.pack("<HHH", 0x206E, m_ws_file, 0x0021)
    # 10. invoke-virtual {v1, v2}, WebSettings.setAllowFileAccessFromFileURLs(Z) -> 6e20 <m> 0021
    insns += struct.pack("<HHH", 0x206E, m_ws_file_urls, 0x0021)
    # 11. invoke-virtual {v1, v2}, WebSettings.setAllowUniversalAccessFromFileURLs(Z) -> 6e20 <m> 0021
    insns += struct.pack("<HHH", 0x206E, m_ws_univ_urls, 0x0021)
    # 12. new-instance v1, WebViewClient -> 2201 <type>
    insns += struct.pack("<HH", 0x0122, t_idx["Landroid/webkit/WebViewClient;"])
    # 13. invoke-direct {v1}, WebViewClient.<init>() -> 7010 <m> 0001
    insns += struct.pack("<HHH", 0x1070, m_wvc_init, 0x0001)
    # 14. invoke-virtual {v0, v1}, WebView.setWebViewClient(WebViewClient) -> 6e20 <m> 0010
    insns += struct.pack("<HHH", 0x206E, m_wv_set_wvc, 0x0010)
    # 15. new-instance v1, WebChromeClient -> 2201 <type>
    insns += struct.pack("<HH", 0x0122, t_idx["Landroid/webkit/WebChromeClient;"])
    # 16. invoke-direct {v1}, WebChromeClient.<init>() -> 7010 <m> 0001
    insns += struct.pack("<HHH", 0x1070, m_wcc_init, 0x0001)
    # 17. invoke-virtual {v0, v1}, WebView.setWebChromeClient(WebChromeClient) -> 6e20 <m> 0010
    insns += struct.pack("<HHH", 0x206E, m_wv_set_wcc, 0x0010)
    # 18. invoke-virtual {v3, v0}, Activity.setContentView(View) -> 6e20 <m> 0003
    insns += struct.pack("<HHH", 0x206E, m_set_content, 0x0003)
    # 19. const-string v2, target_url -> 1a02 <str_idx>
    insns += struct.pack("<HH", 0x021A, s_idx[target_url])
    # 20. invoke-virtual {v0, v2}, WebView.loadUrl(String) -> 6e20 <m> 0020
    insns += struct.pack("<HHH", 0x206E, m_wv_load, 0x0020)
    # 21. return-void -> 0e00
    insns += struct.pack("<H", 0x000E)

    code_oncreate = struct.pack("<HHHHII", 5, 2, 2, 0, 0, len(insns) // 2) + bytes(insns)

    # Layout calculation for DEX sections
    header_size = 0x70
    string_ids_off = header_size
    string_ids_size = len(raw_strings)
    type_ids_off = string_ids_off + string_ids_size * 4
    type_ids_size = len(raw_types)
    proto_ids_off = type_ids_off + type_ids_size * 4
    proto_ids_size = len(raw_protos)
    method_ids_off = proto_ids_off + proto_ids_size * 12
    method_ids_size = len(raw_methods)
    class_defs_off = method_ids_off + method_ids_size * 8
    class_defs_size = 1

    data_off = class_defs_off + class_defs_size * 32
    cur = data_off

    # 1. type_list items for protos with parameters
    proto_type_list_offs = []
    type_lists_buf = bytearray()
    for _, _, params in raw_protos:
        if not params:
            proto_type_list_offs.append(0)
        else:
            while (cur + len(type_lists_buf)) % 4 != 0:
                type_lists_buf.append(0)
            proto_type_list_offs.append(cur + len(type_lists_buf))
            type_lists_buf += struct.pack("<I", len(params))
            for pt in params:
                type_lists_buf += struct.pack("<H", t_idx[pt])
            if len(params) % 2 == 1:
                type_lists_buf += struct.pack("<H", 0)

    # 2. code_item blocks (4-byte aligned)
    while (cur + len(type_lists_buf)) % 4 != 0:
        type_lists_buf.append(0)
    code_init_off = cur + len(type_lists_buf)
    code_buf = bytearray(code_init)
    while (code_init_off + len(code_buf)) % 4 != 0:
        code_buf.append(0)
    code_oncreate_off = code_init_off + len(code_buf)
    code_buf += code_oncreate
    while (code_oncreate_off + len(code_oncreate) + (len(code_buf) - len(code_init) - len(code_oncreate))) % 4 != 0:
        code_buf.append(0)

    # 3. string_data_item blocks
    str_data_base = code_init_off + len(code_buf)
    str_data_offs = []
    str_data_buf = bytearray()
    for s in raw_strings:
        str_data_offs.append(str_data_base + len(str_data_buf))
        utf8_b = s.encode("utf-8")
        str_data_buf += uleb128(len(s)) + utf8_b + b"\x00"

    # 4. class_data_item
    class_data_off = str_data_base + len(str_data_buf)
    m_this_init = m_idx[(cls_desc, "<init>", ("V", ()))]
    m_this_oncreate = m_idx[(cls_desc, "onCreate", ("V", ("Landroid/os/Bundle;",)))]

    class_data_buf = bytearray()
    class_data_buf += uleb128(0)  # static_fields_size
    class_data_buf += uleb128(0)  # instance_fields_size
    class_data_buf += uleb128(1)  # direct_methods_size (<init>)
    class_data_buf += uleb128(1)  # virtual_methods_size (onCreate)
    # direct_method: <init> (PUBLIC | CONSTRUCTOR = 0x10001)
    class_data_buf += uleb128(m_this_init)
    class_data_buf += uleb128(0x10001)
    class_data_buf += uleb128(code_init_off)
    # virtual_method: onCreate (PROTECTED = 0x0004)
    class_data_buf += uleb128(m_this_oncreate)
    class_data_buf += uleb128(0x0004)
    class_data_buf += uleb128(code_oncreate_off)

    # 5. map_list (4-byte aligned at end of data section)
    pre_map = type_lists_buf + code_buf + str_data_buf + class_data_buf
    while (data_off + len(pre_map)) % 4 != 0:
        pre_map.append(0)
    map_off = data_off + len(pre_map)

    map_items = [
        (0x0000, 1, 0),
        (0x0001, string_ids_size, string_ids_off),
        (0x0002, type_ids_size, type_ids_off),
        (0x0003, proto_ids_size, proto_ids_off),
        (0x0005, method_ids_size, method_ids_off),
        (0x0006, class_defs_size, class_defs_off),
        (0x1001, sum(1 for x in proto_type_list_offs if x > 0), data_off),
        (0x2001, 2, code_init_off),
        (0x2002, string_ids_size, str_data_base),
        (0x2000, 1, class_data_off),
        (0x1000, 1, map_off),
    ]
    map_buf = struct.pack("<I", len(map_items))
    for m_type, m_size, m_offset in map_items:
        map_buf += struct.pack("<HHII", m_type, 0, m_size, m_offset)

    data_section = bytes(pre_map) + map_buf
    file_size = data_off + len(data_section)
    data_size = len(data_section)

    # Serialize index tables
    string_ids_bytes = b"".join(struct.pack("<I", o) for o in str_data_offs)
    type_ids_bytes = b"".join(struct.pack("<I", s_idx[t]) for t in raw_types)
    proto_ids_bytes = b"".join(
        struct.pack("<III", s_idx[p[0]], t_idx[p[1]], tl_off)
        for p, tl_off in zip(raw_protos, proto_type_list_offs)
    )
    method_ids_bytes = b"".join(
        struct.pack("<HHI", t_idx[m[0]], p_idx[m[1]], s_idx[m[2]])
        for m in raw_methods
    )
    class_defs_bytes = struct.pack(
        "<IIIIIIII",
        t_idx[cls_desc],
        0x0001,  # ACC_PUBLIC
        t_idx["Landroid/app/Activity;"],
        0,       # interfaces_off
        NO_STR if " MainActivity.java" not in s_idx else s_idx[" MainActivity.java"],
        0,       # annotations_off
        class_data_off,
        0,       # static_values_off
    )

    body_after_sig = (
        struct.pack(
            "<IIIIIIIIIIIIIIIIIIII",
            file_size,
            0x70,
            0x12345678,  # ENDIAN_CONSTANT
            0,           # link_size
            0,           # link_off
            map_off,
            string_ids_size,
            string_ids_off,
            type_ids_size,
            type_ids_off,
            proto_ids_size,
            proto_ids_off,
            0,           # field_ids_size
            0,           # field_ids_off
            method_ids_size,
            method_ids_off,
            class_defs_size,
            class_defs_off,
            data_size,
            data_off,
        )
        + string_ids_bytes
        + type_ids_bytes
        + proto_ids_bytes
        + method_ids_bytes
        + class_defs_bytes
        + data_section
    )

    sha1_sig = hashlib.sha1(body_after_sig).digest()
    adler = zlib.adler32(sha1_sig + body_after_sig) & 0xFFFFFFFF
    dex_bytes = b"dex\n035\x00" + struct.pack("<I", adler) + sha1_sig + body_after_sig
    return dex_bytes


def sign_apk_v1(unsigned_apk_path: str, signed_apk_path: str, cert_pem: str, key_pem: str, entries: dict):
    """
    Adds JAR V1 signature files (META-INF/MANIFEST.MF, META-INF/CERT.SF, META-INF/CERT.RSA)
    using OpenSSL CMS / PKCS7 detached signature.
    """
    import base64

    manifest_lines = [
        "Manifest-Version: 1.0",
        "Created-By: 1.0 (Android Faraja Build)",
        "",
    ]
    sf_entries = []

    for name, data in entries.items():
        digest_b64 = base64.b64encode(hashlib.sha256(data).digest()).decode("ascii")
        section = f"Name: {name}\r\nSHA-256-Digest: {digest_b64}\r\n\r\n"
        manifest_lines.append(section.rstrip("\r\n"))
        manifest_lines.append("")

        sec_digest = base64.b64encode(hashlib.sha256(section.encode("utf-8")).digest()).decode("ascii")
        sf_entries.append(f"Name: {name}\r\nSHA-256-Digest: {sec_digest}\r\n\r\n")

    manifest_bytes = "\r\n".join(manifest_lines).encode("utf-8")
    main_digest = base64.b64encode(hashlib.sha256(manifest_bytes).digest()).decode("ascii")
    sf_header = (
        "Signature-Version: 1.0\r\n"
        "Created-By: 1.0 (Android Faraja Build)\r\n"
        f"SHA-256-Digest-Manifest: {main_digest}\r\n\r\n"
    )
    sf_bytes = (sf_header + "".join(sf_entries)).encode("utf-8")

    with tempfile.NamedTemporaryFile(delete=False) as sf_f:
        sf_f.write(sf_bytes)
        sf_path = sf_f.name

    rsa_path = sf_path + ".rsa"
    subprocess.run(
        [
            "openssl",
            "cms",
            "-sign",
            "-binary",
            "-noattr",
            "-in",
            sf_path,
            "-signer",
            cert_pem,
            "-inkey",
            key_pem,
            "-outform",
            "DER",
            "-out",
            rsa_path,
            "-md",
            "sha256",
        ],
        check=True,
    )
    with open(rsa_path, "rb") as f:
        rsa_bytes = f.read()
    os.unlink(sf_path)
    os.unlink(rsa_path)

    with zipfile.ZipFile(signed_apk_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
        zf.writestr("META-INF/MANIFEST.MF", manifest_bytes)
        zf.writestr("META-INF/CERT.SF", sf_bytes)
        zf.writestr("META-INF/CERT.RSA", rsa_bytes)


def lp_bytes(b: bytes) -> bytes:
    return struct.pack("<I", len(b)) + b


def compute_v2_content_digest(sec1: bytes, sec3: bytes, sec4_with_orig_cd: bytes) -> bytes:
    chunk_digests = []
    chunk_size = 1024 * 1024
    for section in (sec1, sec3, sec4_with_orig_cd):
        offset = 0
        n = len(section)
        while offset < n:
            chunk = section[offset : offset + chunk_size]
            h = hashlib.sha256()
            h.update(b"\xa5" + struct.pack("<I", len(chunk)) + chunk)
            chunk_digests.append(h.digest())
            offset += chunk_size
    top = hashlib.sha256()
    top.update(b"\x5a" + struct.pack("<I", len(chunk_digests)) + b"".join(chunk_digests))
    return top.digest()


def add_apk_sig_v2_block(apk_path: str, cert_pem: str, key_pem: str):
    """
    Inserts an Android APK Signature Scheme v2 block (ID 0x7109871a, 'APK Sig Block 42')
    before the ZIP Central Directory so Android 7-14+ PackageInstaller verifies V1+V2.
    """
    with open(apk_path, "rb") as f:
        raw_zip = f.read()

    # Locate End of Central Directory (EOCD: 0x06054b50)
    eocd_pos = raw_zip.rfind(b"PK\x05\x06")
    if eocd_pos < 0:
        return
    cd_size = struct.unpack_from("<I", raw_zip, eocd_pos + 12)[0]
    cd_offset = struct.unpack_from("<I", raw_zip, eocd_pos + 16)[0]

    sec1 = raw_zip[:cd_offset]
    sec3 = raw_zip[cd_offset:eocd_pos]
    sec4 = bytearray(raw_zip[eocd_pos:])

    # Digest uses EOCD with original cd_offset
    digest = compute_v2_content_digest(sec1, sec3, bytes(sec4))

    # Get DER certificate and SPKI public key via openssl
    cert_der = subprocess.check_output(["openssl", "x509", "-in", cert_pem, "-outform", "DER"])
    pubkey_der = subprocess.check_output(
        ["openssl", "pkey", "-in", key_pem, "-pubout", "-outform", "DER"]
    )

    # 0x0103 = SIGNATURE_RSA_PKCS1_V1_5_WITH_SHA256
    alg_id = 0x0103
    digest_entry = lp_bytes(struct.pack("<I", alg_id) + lp_bytes(digest))
    digests_seq = lp_bytes(digest_entry)
    certs_seq = lp_bytes(lp_bytes(cert_der))
    attr_seq = lp_bytes(b"")  # empty additional attributes

    signed_data = digests_seq + certs_seq + attr_seq

    with tempfile.NamedTemporaryFile(delete=False) as sd_f:
        sd_f.write(signed_data)
        sd_path = sd_f.name

    sig_bytes = subprocess.check_output(
        ["openssl", "dgst", "-sha256", "-sign", key_pem, sd_path]
    )
    os.unlink(sd_path)

    sig_entry = lp_bytes(struct.pack("<I", alg_id) + lp_bytes(sig_bytes))
    sigs_seq = lp_bytes(sig_entry)

    signer = lp_bytes(signed_data) + sigs_seq + lp_bytes(pubkey_der)
    v2_value = lp_bytes(lp_bytes(signer))

    pair_payload = struct.pack("<I", 0x7109871A) + v2_value
    pair = struct.pack("<Q", len(pair_payload)) + pair_payload

    # Pad block so total APK Signing Block is a multiple of 4096 bytes if needed, or exact
    block_size_field = len(pair) + 8 + 16
    sig_block = (
        struct.pack("<Q", block_size_field)
        + pair
        + struct.pack("<Q", block_size_field)
        + b"APK Sig Block 42"
    )

    new_cd_offset = cd_offset + len(sig_block)
    struct.pack_into("<I", sec4, 16, new_cd_offset)

    with open(apk_path, "wb") as f:
        f.write(sec1 + sig_block + sec3 + bytes(sec4))


def build_signed_apk(output_path: str, package_name: str, app_label: str, target_url: str, cert_pem: str, key_pem: str, asset_entries: dict = None):
    axml = build_axml_manifest(package_name, app_label, 1, "1.0.0")
    dex = build_webview_dex(package_name, target_url)
    entries = {
        "AndroidManifest.xml": axml,
        "classes.dex": dex,
    }
    if asset_entries:
        entries.update(asset_entries)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sign_apk_v1(output_path, output_path, cert_pem, key_pem, entries)
    add_apk_sig_v2_block(output_path, cert_pem, key_pem)


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out_dir = os.path.join(root_dir, "download")
    public_download_dir = os.path.join(root_dir, "public", "download")
    dist_dir = os.path.join(root_dir, "dist")
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(public_download_dir, exist_ok=True)

    # Ensure production web bundle is built
    if not os.path.exists(dist_dir) or not os.path.exists(os.path.join(dist_dir, "index.html")):
        subprocess.run(["npm", "run", "build"], cwd=root_dir, check=True)

    # Collect all built production assets from dist/ for offline embedded APK bundle
    asset_entries = {}
    if os.path.exists(dist_dir):
        for root, dirs, files in os.walk(dist_dir):
            for f in files:
                full_p = os.path.join(root, f)
                rel_p = os.path.relpath(full_p, dist_dir).replace("\\", "/")
                with open(full_p, "rb") as fh:
                    content = fh.read()
                if rel_p == "index.html":
                    html_text = content.decode("utf-8")
                    html_text = html_text.replace('<script type="module" crossorigin src="', '<script defer src="')
                    html_text = html_text.replace('<script type="module" src="', '<script defer src="')
                    html_text = html_text.replace('crossorigin ', '')
                    content = html_text.encode("utf-8")
                asset_entries[f"assets/{rel_p}"] = content

    with tempfile.TemporaryDirectory() as tmpdir:
        key_pem = os.path.join(tmpdir, "release.key.pem")
        cert_pem = os.path.join(tmpdir, "release.cert.pem")
        subprocess.run(
            [
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-keyout",
                key_pem,
                "-out",
                cert_pem,
                "-days",
                "10000",
                "-nodes",
                "-subj",
                "/CN=Faraja Ravi Official/O=Faraja/C=IR",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        citizen_apk = os.path.join(out_dir, "ravi-citizen.apk")
        admin_apk = os.path.join(out_dir, "ravi-admin.apk")

        # 1. Citizen Reporting App: Name is strictly "راوی", loads locally from file:///android_asset/index.html
        build_signed_apk(
            citizen_apk,
            "ir.faraja.ravi.citizen",
            "راوی",
            "file:///android_asset/index.html",
            cert_pem,
            key_pem,
            asset_entries,
        )

        # 2. Standalone Admin Panel: Loads locally from file:///android_asset/index.html#/admin
        build_signed_apk(
            admin_apk,
            "ir.faraja.ravi.admin",
            "مدیریت راوی",
            "file:///android_asset/index.html#/admin",
            cert_pem,
            key_pem,
            asset_entries,
        )

        import shutil
        shutil.copy2(citizen_apk, os.path.join(public_download_dir, "ravi-citizen.apk"))
        shutil.copy2(admin_apk, os.path.join(public_download_dir, "ravi-admin.apk"))

        print("Built Standalone APK Bundle:", citizen_apk, os.path.getsize(citizen_apk), "bytes")
        print("Built Standalone APK Bundle:", admin_apk, os.path.getsize(admin_apk), "bytes")


if __name__ == "__main__":
    main()

