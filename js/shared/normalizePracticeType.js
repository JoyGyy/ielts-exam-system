/**
 * 标准化练习类型名称
 * @param {string} type - 原始类型
 * @returns {string|null} 标准化后的类型，无法识别时返回 null
 */
export function normalizePracticeType(type) {
    if (!type) return null;
    const normalized = String(type).toLowerCase();
    if (normalized.includes('listen')) return 'listening';
    if (normalized.includes('read')) return 'reading';
    return null;
}
