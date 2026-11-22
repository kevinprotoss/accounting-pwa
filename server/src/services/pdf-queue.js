import PQueue from 'p-queue';
import { generateAndSaveInvoicePdf } from './invoice-pdf.js';

const pdfQueue = new PQueue({ concurrency: 1 });
const taskMap = new Map();
const TIMEOUT_MS = 60_000;

export function isGenerating(issueId) {
  return taskMap.has(issueId);
}

export function enqueueInvoice(issueId) {
  if (taskMap.has(issueId)) return 'generating';
  taskMap.set(issueId, { startedAt: Date.now() });
  pdfQueue.add(() => runTask(issueId));
  return 'started';
}

async function runTask(issueId) {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PDF generation timeout')), TIMEOUT_MS)
    );
    await Promise.race([generateAndSaveInvoicePdf(issueId), timeoutPromise]);
  } catch (err) {
    console.error(`[pdf] task failed for issue ${issueId}:`, err.message);
  } finally {
    taskMap.delete(issueId);
  }
}