/**
 * Pure row parsing for school student and relationship imports from Noor and Excel sheets.
 *
 * Browser- and XLSX-independent so the business mapping can be executed directly
 * in both browser runtime and automated contract/unit tests.
 */

export interface ImportRow {
  name: string;
  email: string;
  className?: string;
  password?: string;
  civilId?: string;
}

export interface RelationImportRow {
  studentEmail: string;
  parentEmail?: string;
  parentName?: string;
  supervisorEmail?: string;
  supervisorName?: string;
  teacherEmail?: string;
  teacherName?: string;
  className?: string;
}

export interface ParsedImportStats {
  totalRows: number;
  validCount: number;
  classNames: string[];
  rowsWithoutPassword: number;
  duplicateEmails: string[];
  existingEmails: string[];
  errors: Array<{ rowNumber: number; message: string }>;
}

export const normalizeImportHeader = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, '')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, '');

export const normalizeArabicText = (value: string): string =>
  value
    .trim()
    .replace(/\uFEFF/g, '')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');

const aliasSet = (aliases: string[]) => new Set(aliases.map(normalizeImportHeader));

export const STUDENT_IMPORT_HEADER_ALIASES = {
  name: aliasSet(['name', 'fullname', 'studentname', 'الاسم', 'اسمالطالب', 'الاسمكامل', 'اسم', 'الطالب']),
  email: aliasSet(['email', 'mail', 'البريد', 'البريدالالكتروني', 'البريدالإلكتروني', 'الايميل', 'الإيميل', 'بريدالطالب']),
  civilId: aliasSet(['civilid', 'nationalid', 'id', 'الهويةالوطنية', 'رقمالهوية', 'السجلالمدني', 'رقمالسجل', 'الهوية', 'السجل']),
  className: aliasSet(['classname', 'class', 'classroom', 'الفصل', 'اسمالفصل', 'الصف', 'المجموعة', 'فصل']),
  password: aliasSet(['password', 'pass', 'كلمةالمرور', 'كلمةالسر', 'الرقمالسري', 'passwordhint']),
};

export const RELATION_IMPORT_HEADER_ALIASES = {
  studentEmail: aliasSet(['studentemail', 'student', 'بريدالطالب', 'ايميلالطالب', 'إيميلالطالب', 'البريدالالكترونيللطالب']),
  parentEmail: aliasSet(['parentemail', 'parent', 'وليالامر', 'وليالأمر', 'بريدوليالامر', 'بريدوليالأمر', 'ايميلوليالامر']),
  parentName: aliasSet(['parentname', 'اسموليالامر', 'اسموليالأمر', 'وليالامر', 'guardianname']),
  supervisorEmail: aliasSet(['supervisoremail', 'بريدالمشرف', 'ايميلالمشرف', 'إيميلالمشرف']),
  supervisorName: aliasSet(['supervisorname', 'اسمالمشرف']),
  teacherEmail: aliasSet(['teacheremail', 'بريدالمعلم', 'ايميلالمعلم', 'إيميلالمعلم']),
  teacherName: aliasSet(['teachername', 'اسمالمعلم']),
  className: aliasSet(['classname', 'class', 'الفصل', 'اسمالفصل', 'الصف', 'المجموعة']),
};

export const normalizeRows = (rows: unknown[][]): string[][] =>
  rows
    .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []))
    .filter((row) => row.some(Boolean));

export const canonicalizeHeader = <TKey extends string>(
  header: string,
  aliases: Record<TKey, Set<string>>,
): TKey | null => {
  const normalized = normalizeImportHeader(header);
  const entry = (Object.entries(aliases) as Array<[TKey, Set<string>]>).find(([, values]) =>
    values.has(normalized),
  );
  return entry?.[0] ?? null;
};

/**
 * Splits CSV, TSV (tab-delimited Noor data), or semicolon-separated text into rows and columns.
 */
export const parseTextToRows = (rawText: string): string[][] => {
  const cleaned = rawText.replace(/\uFEFF/g, '').trim();
  if (!cleaned) return [];

  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Determine delimiter from the header line
  const firstLine = lines[0];
  let delimiter = '\t';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(',')) {
    delimiter = ',';
  } else if (firstLine.includes(';')) {
    delimiter = ';';
  }

  return lines.map((line) => {
    if (delimiter === ',') {
      // Basic CSV field parser handling quoted strings
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }
    return line.split(delimiter).map((cell) => cell.trim());
  });
};

/**
 * Parses 2D array of rows into ImportRow objects.
 * Compatible with Noor exports and Excel sheets.
 */
export const parseImportRows = (rows: unknown[][]): ImportRow[] => {
  const normalizedRows = normalizeRows(rows);
  if (normalizedRows.length < 2) return [];

  const headers = normalizedRows[0].map((header) => {
    const canonical = canonicalizeHeader(header, STUDENT_IMPORT_HEADER_ALIASES);
    return normalizeImportHeader(canonical ?? header);
  });

  const nameIndex = headers.findIndex((h) => h === 'name');
  const emailIndex = headers.findIndex((h) => h === 'email');
  const civilIdIndex = headers.findIndex((h) => h === 'civilid');
  const classIndex = headers.findIndex((h) => h === 'classname');
  const passwordIndex = headers.findIndex((h) => h === 'password');

  if (nameIndex === -1 && emailIndex === -1 && civilIdIndex === -1) {
    throw new Error('الملف يحتاج عمودين أساسيين على الأقل: الاسم والبريد الإلكتروني (أو السجل المدني).');
  }

  if (nameIndex === -1) {
    throw new Error('الملف يحتاج عمود اسم الطالب (name).');
  }

  if (emailIndex === -1 && civilIdIndex === -1) {
    throw new Error('الملف يحتاج عمود البريد الإلكتروني (email) أو السجل المدني.');
  }

  return normalizedRows
    .slice(1)
    .map((cells) => {
      const name = (cells[nameIndex] || '').trim();
      let email = emailIndex >= 0 ? (cells[emailIndex] || '').trim().toLowerCase() : '';
      const civilId = civilIdIndex >= 0 ? (cells[civilIdIndex] || '').trim() : undefined;
      const className = classIndex >= 0 ? (cells[classIndex] || '').trim() : undefined;
      const password = passwordIndex >= 0 ? (cells[passwordIndex] || '').trim() : undefined;

      // If email is missing but civilId exists, generate standard student email
      if (!email && civilId) {
        email = `std-${civilId}@almeaa.edu.sa`;
      }

      return {
        name,
        email,
        civilId,
        className,
        password,
      };
    })
    .filter((row) => row.name && row.email);
};

export const parseRelationRows = (rows: unknown[][]): RelationImportRow[] => {
  const normalizedRows = normalizeRows(rows);
  if (normalizedRows.length < 2) return [];

  const headers = normalizedRows[0].map((header) => {
    const canonical = canonicalizeHeader(header, RELATION_IMPORT_HEADER_ALIASES);
    return normalizeImportHeader(canonical ?? header);
  });

  const studentEmailIndex = headers.findIndex((h) => h === 'studentemail');
  const parentEmailIndex = headers.findIndex((h) => h === 'parentemail');
  const parentNameIndex = headers.findIndex((h) => h === 'parentname');
  const supervisorEmailIndex = headers.findIndex((h) => h === 'supervisoremail');
  const supervisorNameIndex = headers.findIndex((h) => h === 'supervisorname');
  const teacherEmailIndex = headers.findIndex((h) => h === 'teacheremail');
  const teacherNameIndex = headers.findIndex((h) => h === 'teachername');
  const classNameIndex = headers.findIndex((h) => h === 'classname');

  if (studentEmailIndex === -1) {
    throw new Error('ملف الربط يحتاج عمود بريد الطالب على الأقل.');
  }

  return normalizedRows
    .slice(1)
    .map((cells) => ({
      studentEmail: (cells[studentEmailIndex] || '').trim().toLowerCase(),
      parentEmail: parentEmailIndex >= 0 ? (cells[parentEmailIndex] || '').trim().toLowerCase() : undefined,
      parentName: parentNameIndex >= 0 ? (cells[parentNameIndex] || '').trim() : undefined,
      supervisorEmail: supervisorEmailIndex >= 0 ? (cells[supervisorEmailIndex] || '').trim().toLowerCase() : undefined,
      supervisorName: supervisorNameIndex >= 0 ? (cells[supervisorNameIndex] || '').trim() : undefined,
      teacherEmail: teacherEmailIndex >= 0 ? (cells[teacherEmailIndex] || '').trim().toLowerCase() : undefined,
      teacherName: teacherNameIndex >= 0 ? (cells[teacherNameIndex] || '').trim() : undefined,
      className: classNameIndex >= 0 ? (cells[classNameIndex] || '').trim() : undefined,
    }))
    .filter((row) => row.studentEmail || row.parentEmail || row.supervisorEmail || row.teacherEmail || row.className);
};

export const getDuplicateImportEmails = (rows: ImportRow[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  rows.forEach((row) => {
    const email = row.email.trim().toLowerCase();
    if (!email) return;
    if (seen.has(email)) {
      duplicates.add(email);
      return;
    }
    seen.add(email);
  });

  return Array.from(duplicates);
};

export const getDuplicateImportEmailsError = (rows: ImportRow[]): string | null => {
  const duplicateEmails = getDuplicateImportEmails(rows);
  if (!duplicateEmails.length) {
    return null;
  }

  return `يوجد بريد مكرر داخل الملف: ${duplicateEmails.slice(0, 3).join(', ')}${
    duplicateEmails.length > 3 ? '...' : ''
  }. صحح الملف ثم ارفعه مرة أخرى.`;
};

/**
 * Validates text or rows with detailed diagnostics for Noor Excel roster imports.
 */
export const inspectImportData = (rows: ImportRow[]): ParsedImportStats => {
  const duplicateEmails = getDuplicateImportEmails(rows);
  const classesSet = new Set<string>();
  let rowsWithoutPassword = 0;
  const errors: Array<{ rowNumber: number; message: string }> = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1
    if (!row.name || row.name.length < 2) {
      errors.push({ rowNumber: rowNum, message: `الصف ${rowNum}: اسم الطالب غير صالح أو قصير جداً` });
    }
    if (!row.email || !row.email.includes('@')) {
      errors.push({ rowNumber: rowNum, message: `الصف ${rowNum}: البريد الإلكتروني غير صالح (${row.email})` });
    }
    if (row.className) {
      classesSet.add(row.className.trim());
    }
    if (!row.password) {
      rowsWithoutPassword++;
    }
  });

  return {
    totalRows: rows.length,
    validCount: rows.length - errors.length,
    classNames: Array.from(classesSet),
    rowsWithoutPassword,
    duplicateEmails,
    existingEmails: [],
    errors,
  };
};
