/**
 * Google Apps Script backend
 * ==========================
 * 1) أنشئ مجلدًا رئيسيًا في Google Drive لتسليمات الطالبات.
 * 2) انسخ ID المجلد من رابطه وضعه أدناه.
 * 3) Deploy > New deployment > Web app
 * 4) Execute as: Me
 * 5) Who has access: Anyone (أو الإعداد المناسب لحساب المدرسة)
 * 6) انسخ رابط /exec وضعه في config.js داخل الموقع.
 */

const ROOT_FOLDER_ID = 'PUT_YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE';
const MAX_FILE_SIZE_MB = 25;

function doGet() {
  return jsonResponse({ ok: true, service: 'Quran Recitation Upload API' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('لم تصل بيانات إلى الخادم.');
    }

    if (!ROOT_FOLDER_ID || ROOT_FOLDER_ID.indexOf('PUT_YOUR_') === 0) {
      throw new Error('يجب ضبط ROOT_FOLDER_ID أولًا داخل Code.gs.');
    }

    const data = JSON.parse(e.postData.contents);
    validateData(data);

    const base64 = String(data.fileData).split(',')[1];
    if (!base64) throw new Error('بيانات الملف غير صالحة.');

    const bytes = Utilities.base64Decode(base64);
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (bytes.length > maxBytes) {
      throw new Error('حجم الملف أكبر من الحد المسموح.');
    }

    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const surahFolder = getOrCreateFolder(rootFolder, 'سورة ' + sanitize(data.surah));

    const extension = getExtension(data.originalFileName, data.mimeType);
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Amman', 'yyyy-MM-dd_HH-mm');
    const safeStudent = sanitize(data.studentName);
    const safeClass = sanitize(data.studentClass);
    const safeSurah = sanitize(data.surah);
    const fileName = `${safeStudent}_${safeClass}_سورة-${safeSurah}_${timestamp}.${extension}`;

    const blob = Utilities.newBlob(bytes, data.mimeType, fileName);
    const file = surahFolder.createFile(blob);

    return jsonResponse({
      ok: true,
      message: 'تم حفظ الملف بنجاح.',
      fileId: file.getId(),
      fileName: file.getName()
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: String(error.message || error) });
  }
}

function validateData(data) {
  if (!data) throw new Error('البيانات غير موجودة.');
  if (!data.studentName || !String(data.studentName).trim()) throw new Error('اسم الطالبة مطلوب.');
  if (!data.studentClass || !String(data.studentClass).trim()) throw new Error('الصف مطلوب.');
  if (!data.surah || !String(data.surah).trim()) throw new Error('اسم السورة مطلوب.');
  if (!data.fileData) throw new Error('الملف مطلوب.');
  if (!data.mimeType || (!String(data.mimeType).startsWith('audio/') && !String(data.mimeType).startsWith('video/'))) {
    throw new Error('يسمح فقط بملفات الصوت أو الفيديو.');
  }
}

function getOrCreateFolder(parent, folderName) {
  const folders = parent.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : parent.createFolder(folderName);
}

function sanitize(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s+/g, '-')
    .substring(0, 80) || 'غير-محدد';
}

function getExtension(originalName, mimeType) {
  const original = String(originalName || '');
  const match = original.match(/\.([A-Za-z0-9]{1,8})$/);
  if (match) return match[1].toLowerCase();

  const map = {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm'
  };
  return map[mimeType] || (String(mimeType).startsWith('audio/') ? 'audio' : 'video');
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
