// examIndex.js - 题库索引 (O(1) lookup via Map)
let examIndexMap = new Map();

export function buildExamIndex(exams) {
  examIndexMap.clear();
  if (Array.isArray(exams)) {
    for (const exam of exams) {
      if (exam && exam.id != null) {
        examIndexMap.set(exam.id, exam);
      }
    }
  }
}

export function getExamById(id) {
  return examIndexMap.get(id) || null;
}

export function hasExam(id) {
  return examIndexMap.has(id);
}

export function getExamCount() {
  return examIndexMap.size;
}

// Expose on window for IIFE-pattern files
if (typeof window !== 'undefined') {
  window.getExamById = getExamById;
  window.hasExam = hasExam;
  window.getExamCount = getExamCount;
  window.buildExamIndex = buildExamIndex;
}
