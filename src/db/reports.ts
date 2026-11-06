import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { reports } from './schema.ts';

export interface ReportPayload {
  id: string;
  userUid?: string | null;
  created?: number;
  title?: string;
  text: string;
  status?: string;
  qualityGrade?: string;
  quantityNote?: string;
  newsDomain?: string[] | string;
  reporter?: Record<string, any>;
  answers?: Record<string, any>;
  extra?: Record<string, any>;
  analysis?: Record<string, any>;
  files?: Array<Record<string, any>>;
  interview?: Record<string, any>;
}

function mapRowToClientReport(row: typeof reports.$inferSelect) {
  return {
    id: row.reportId,
    dbId: row.id,
    userUid: row.userUid,
    created: Number(row.createdTimestamp) || (row.createdAt ? new Date(row.createdAt).getTime() : Date.now()),
    title: row.title,
    text: row.text,
    status: row.status,
    qualityGrade: row.qualityGrade,
    quantityNote: row.quantityNote,
    newsDomain: Array.isArray(row.newsDomain) ? row.newsDomain : ['انتظامی'],
    reporter: row.reporter || {},
    answers: row.answers || {},
    extra: row.extra || {},
    analysis: row.analysis || {},
    files: Array.isArray(row.files) ? row.files : [],
    interview: row.interview || { turns: [] },
  };
}

export async function saveReportToDb(payload: ReportPayload) {
  try {
    const normalizedDomains = Array.isArray(payload.newsDomain)
      ? payload.newsDomain
      : payload.newsDomain
      ? [String(payload.newsDomain)]
      : ['انتظامی'];

    const createdMs = Number(payload.created) || Date.now();

    const result = await db
      .insert(reports)
      .values({
        reportId: payload.id,
        userUid: payload.userUid || null,
        title: payload.title || 'گزارش انتظامی / شهروندی',
        text: payload.text || '',
        status: payload.status || 'جدید',
        qualityGrade: payload.qualityGrade || 'خوب',
        quantityNote: payload.quantityNote || 'کامل',
        newsDomain: normalizedDomains,
        reporter: payload.reporter || {},
        answers: payload.answers || {},
        extra: payload.extra || {},
        analysis: payload.analysis || {},
        files: Array.isArray(payload.files) ? payload.files : [],
        interview: payload.interview || { turns: [] },
        createdTimestamp: createdMs,
      })
      .onConflictDoUpdate({
        target: reports.reportId,
        set: {
          title: payload.title || 'گزارش انتظامی / شهروندی',
          text: payload.text || '',
          status: payload.status || 'جدید',
          qualityGrade: payload.qualityGrade || 'خوب',
          quantityNote: payload.quantityNote || 'کامل',
          newsDomain: normalizedDomains,
          reporter: payload.reporter || {},
          answers: payload.answers || {},
          extra: payload.extra || {},
          analysis: payload.analysis || {},
          files: Array.isArray(payload.files) ? payload.files : [],
          interview: payload.interview || { turns: [] },
        },
      })
      .returning();

    return mapRowToClientReport(result[0]);
  } catch (error) {
    console.error('Database saveReportToDb failed:', error);
    throw new Error('ثبت گزارش در پایگاه داده با خطا مواجه شد.', { cause: error });
  }
}

export async function listReportsFromDb() {
  try {
    const rows = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdTimestamp), desc(reports.id));
    return rows.map(mapRowToClientReport);
  } catch (error) {
    console.error('Database listReportsFromDb failed:', error);
    throw new Error('واکشی فهرست گزارش‌ها از پایگاه داده با خطا مواجه شد.', { cause: error });
  }
}

export async function updateReportStatusInDb(reportId: string, status: string) {
  try {
    const result = await db
      .update(reports)
      .set({ status })
      .where(eq(reports.reportId, reportId))
      .returning();

    return result[0] ? mapRowToClientReport(result[0]) : null;
  } catch (error) {
    console.error('Database updateReportStatusInDb failed:', error);
    throw new Error('به‌روزرسانی وضعیت گزارش در پایگاه داده با خطا مواجه شد.', { cause: error });
  }
}
