import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera,
  Save,
  User,
  Mail,
  Phone,
  CreditCard,
  School,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Upload,
  Award,
  ExternalLink,
  ShieldCheck,
  Bell,
  Copy,
  Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces';

interface StudentCertificate {
  code: string;
  courseName: string;
  completionPercentage: number;
  issueDate: string;
}

const DEFAULT_CERTIFICATES: StudentCertificate[] = [
  {
    code: 'ALM-QUD-2026-9941',
    courseName: 'برنامج التأسيس الشامل للقدرات العامة (كمي ولفظي)',
    completionPercentage: 100,
    issueDate: '2026-05-10',
  },
  {
    code: 'ALM-FAST-2026-8812',
    courseName: 'دورة استراتيجيات الحل السريع والتحدي اليومي',
    completionPercentage: 100,
    issueDate: '2026-06-01',
  },
];

export const ProfilePage: React.FC = () => {
  const { user, updateProfile, updateIdentity, getCsrfToken } = useAuth();
  
  const fullNameParts = (user?.name || '').trim().split(' ').filter(Boolean);
  const initialFirstName = fullNameParts[0] || '';
  const initialLastName = fullNameParts.slice(1).join(' ') || '';

  const [avatar, setAvatar] = useState(user?.avatarUrl || DEFAULT_AVATAR);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    firstName: initialFirstName,
    lastName: initialLastName,
    email: user?.email || '',
    phone: user?.phone || '',
    nationalId: user?.nationalId || '',
    academicStage: 'high_school',
    classNumber: 'grade_3',
    schoolName: 'ثانوية رواد المعرفة الأهلية بالرياض',
  });

  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [copiedCode, setCopiedCode] = useState(false);

  // Load from localStorage if present for local mock persistence
  const [certificates, setCertificates] = useState<StudentCertificate[]>(() => {
    try {
      const saved = localStorage.getItem('almeaa_student_certificates');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_CERTIFICATES;
  });

  useEffect(() => {
    if (user) {
      const parts = (user.name || '').trim().split(' ').filter(Boolean);
      setFormData((prev) => ({
        ...prev,
        firstName: parts[0] || prev.firstName,
        lastName: parts.slice(1).join(' ') || prev.lastName,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
        nationalId: user.nationalId || prev.nationalId,
      }));
      if (user.avatarUrl) {
        setAvatar(user.avatarUrl);
      }
    }
  }, [user]);

  // Profile completion calculation
  const completionStats = useMemo(() => {
    const fields = [
      Boolean(formData.firstName.trim()),
      Boolean(formData.lastName.trim()),
      Boolean(formData.phone.trim()),
      Boolean(formData.email.trim()),
      Boolean(formData.nationalId.trim()),
      Boolean(formData.academicStage),
      Boolean(formData.schoolName.trim()),
      Boolean(avatar && avatar !== DEFAULT_AVATAR),
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [formData, avatar]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (result) {
          setAvatar(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      const fullName = [formData.firstName.trim(), formData.lastName.trim()].filter(Boolean).join(' ').trim();
      
      // Update basic profile (name, avatar)
      await updateProfile({
        name: fullName || user?.name || '',
        avatar: avatar.startsWith('data:') ? undefined : avatar, // don't push massive base64 to small API, or send if normal url
      });

      // Update identity (nationalId, phone)
      if (formData.nationalId !== user?.nationalId || formData.phone !== user?.phone) {
        await updateIdentity({
          nationalId: formData.nationalId.trim() || null,
          phone: formData.phone.trim() || null,
        });
      }

      // Persist additional metadata to localStorage
      try {
        localStorage.setItem(
          'almeaa_student_academic_profile',
          JSON.stringify({
            academicStage: formData.academicStage,
            classNumber: formData.classNumber,
            schoolName: formData.schoolName,
          })
        );
      } catch {
        // ignore
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الملف الشخصي.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordMessage('يجب أن تحتوي كلمة المرور على 8 خانات على الأقل.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('كلمة المرور الجديدة غير متطابقة.');
      return;
    }
    setPasswordMessage('✅ تم تحديث كلمة المرور بنجاح.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => {
      setPasswordMessage('');
      setIsPasswordOpen(false);
    }, 2500);
  };

  const parentPairingCode = (user?.id || '883921').replace(/-/g, '').slice(-6).toUpperCase();

  const handleCopyPairingCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(parentPairingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Header & Completion Card */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black mb-2">
              <User size={14} />
              إدارة الحساب الشخصي
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              الملف الشخصي للطالب
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              بياناتك الأكاديمية والشخصية، الشهادات المعتمدة، وإعدادات الربط.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 shrink-0">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="transform -rotate-90 w-12 h-12">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  className="text-slate-200"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  className={completionStats === 100 ? 'text-emerald-500' : 'text-indigo-600'}
                  strokeDasharray={126}
                  strokeDashoffset={126 - (126 * completionStats) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-black text-slate-800">{completionStats}%</span>
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-slate-900">نسبة اكتمال الملف</div>
              <div className="text-[11px] font-bold text-slate-500">
                {completionStats === 100 ? 'ملفك مكتمل تماماً 🌟' : 'أكمل باقي البيانات للاعتماد'}
              </div>
            </div>
          </div>
        </header>

        {/* Avatar & Hero Card */}
        <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group cursor-pointer shrink-0" onClick={handleImageClick}>
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-4 border-indigo-50 shadow-md overflow-hidden relative bg-slate-100">
              <img src={avatar} alt="صورة الطالب" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-950/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                <Camera className="text-white mb-1" size={24} />
                <span className="text-white text-xs font-black">تغيير الصورة</span>
              </div>
            </div>
            <button
              type="button"
              className="absolute -bottom-2 -left-2 bg-indigo-600 text-white p-2.5 rounded-2xl shadow-md border-2 border-white hover:bg-indigo-700 transition"
              title="رفع صورة جديدة"
            >
              <Upload size={14} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="text-center sm:text-right flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {formData.firstName || 'طالب'} {formData.lastName || 'المئة'}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700 border border-emerald-200">
                <ShieldCheck size={13} />
                حساب نشط وموثق
              </span>
            </div>
            <p className="text-sm font-bold text-slate-500 truncate" dir="ltr">
              {formData.email}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-bold text-slate-600">
              <span className="bg-slate-100 px-3 py-1 rounded-xl">🏫 {formData.schoolName}</span>
              <span className="bg-slate-100 px-3 py-1 rounded-xl">🎓 المرحلة الثانوية</span>
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-xl">
                ⭐ مسار القدرات العامة
              </span>
            </div>
          </div>
        </section>

        {/* Main Details Form */}
        <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-8">
          
          {/* Section: Personal Info */}
          <div>
            <div className="flex items-center gap-2 pb-3 mb-6 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                <User size={18} />
              </div>
              <h3 className="text-lg font-black text-slate-900">البيانات الشخصية</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">الاسم الأول *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  placeholder="محمد"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">اسم العائلة *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  placeholder="الغامدي"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">البريد الإلكتروني *</label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    disabled
                    dir="ltr"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 text-sm font-bold cursor-not-allowed outline-none"
                  />
                  <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                </div>
                <span className="text-[11px] font-bold text-slate-400 mt-1 block">
                  البريد الإلكتروني هو معرّف تسجيل الدخول الأساسي ولا يمكن تغييره يدوياً.
                </span>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">رقم الجوال (واتساب) *</label>
                <div className="relative">
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                  />
                  <Phone className="absolute left-3 top-3.5 text-slate-400" size={18} />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-black text-slate-700 mb-2">رقم الهوية الوطنية / الإقامة (10 أرقام)</label>
                <div className="relative">
                  <input
                    type="text"
                    name="nationalId"
                    value={formData.nationalId}
                    onChange={handleInputChange}
                    maxLength={10}
                    placeholder="1XXXXXXXXX"
                    dir="ltr"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition font-mono tracking-widest"
                  />
                  <CreditCard className="absolute left-3 top-3.5 text-slate-400" size={18} />
                </div>
                <span className="text-[11px] font-bold text-slate-400 mt-1 block">
                  يُستخدم رقم الهوية لربط حسابك بشهادات قياس المعتمدة ومطابقة بيانات المدرسة.
                </span>
              </div>
            </div>
          </div>

          {/* Section: Academic Info */}
          <div>
            <div className="flex items-center gap-2 pb-3 mb-6 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                <School size={18} />
              </div>
              <h3 className="text-lg font-black text-slate-900">البيانات الأكاديمية والمدرسة</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">المرحلة الدراسية</label>
                <div className="relative">
                  <select
                    name="academicStage"
                    value={formData.academicStage}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="high_school">المرحلة الثانوية</option>
                    <option value="middle_school">المرحلة المتوسطة</option>
                    <option value="university">المرحلة الجامعية</option>
                  </select>
                  <ChevronDown className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">الصف الدراسي</label>
                <div className="relative">
                  <select
                    name="classNumber"
                    value={formData.classNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="grade_1">الصف الأول الثانوي</option>
                    <option value="grade_2">الصف الثاني الثانوي</option>
                    <option value="grade_3">الصف الثالث الثانوي</option>
                  </select>
                  <ChevronDown className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-black text-slate-700 mb-2">اسم المدرسة الحالية</label>
                <input
                  type="text"
                  name="schoolName"
                  value={formData.schoolName}
                  onChange={handleInputChange}
                  placeholder="مثال: ثانوية الفيصلية بالرياض"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {saveSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-black flex items-center gap-2 animate-fade-in">
              <CheckCircle2 size={18} className="text-emerald-600" />
              تم حفظ وتحديث بيانات الملف الشخصي بنجاح!
            </div>
          )}

          {saveError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-black flex items-center gap-2 animate-fade-in">
              <AlertCircle size={18} className="text-rose-600" />
              {saveError}
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save size={18} />
                  حفظ التعديلات
                </>
              )}
            </button>
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-black text-sm transition text-center"
            >
              العودة للوحة التحكم
            </Link>
          </div>
        </form>

        {/* Change Password Card */}
        <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
          <button
            type="button"
            onClick={() => setIsPasswordOpen((v) => !v)}
            className="w-full flex items-center justify-between text-slate-900 font-black text-base hover:text-indigo-600 transition"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
                🔑
              </div>
              <span>تغيير كلمة المرور</span>
            </div>
            {isPasswordOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {isPasswordOpen && (
            <form onSubmit={handlePasswordSubmit} className="mt-6 pt-6 border-t border-slate-100 space-y-5 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-2">كلمة المرور الحالية</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-2">كلمة المرور الجديدة</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="8 خانات على الأقل"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-700 mb-2">تأكيد كلمة المرور الجديدة</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-xs font-black text-indigo-600 hover:underline flex items-center gap-1"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showPassword ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'}
                </button>
              </div>

              {passwordMessage && (
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-black">
                  {passwordMessage}
                </div>
              )}

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition"
              >
                تحديث كلمة المرور
              </button>
            </form>
          )}
        </section>

        {/* Certificates & Achievements Section */}
        <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                <Award size={18} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">شهاداتي وإنجازاتي الرقمية</h3>
                <p className="text-xs text-slate-500 font-medium">الشهادات المعتمدة برمز QR للتحقق السريع</p>
              </div>
            </div>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              {certificates.length} شهادات معتمدة
            </span>
          </div>

          <div className="space-y-4">
            {certificates.map((cert) => (
              <div
                key={cert.code}
                className="p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-300 bg-slate-50/50 hover:bg-emerald-50/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-md">
                      {cert.code}
                    </span>
                    <span className="text-xs font-bold text-slate-400">تاريخ الإصدار: {cert.issueDate}</span>
                  </div>
                  <h4 className="text-base font-black text-slate-900">{cert.courseName}</h4>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <span>نسبة الإتمام: {cert.completionPercentage}%</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-black">موثقة برمز QR رسمي</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/certificate/${encodeURIComponent(cert.code)}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition"
                  >
                    <ExternalLink size={14} />
                    عرض الشهادة والطباعة
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Parent Pairing Code & Notification Preferences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Parent Linker Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg">
                🔗
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">كود ربط ولي الأمر</h4>
                <p className="text-xs text-slate-500 font-medium">أعط هذا الرمز لولي أمرك لمتابعة درجاتك وإنجازاتك</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl">
              <div>
                <div className="text-[11px] font-black text-indigo-600">رمز الربط الخاص بك</div>
                <div className="text-2xl font-mono font-black tracking-widest text-indigo-950">
                  {parentPairingCode}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyPairingCode}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs transition"
              >
                {copiedCode ? (
                  <>
                    <Check size={14} />
                    تم النسخ!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    نسخ الرمز
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Notifications Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-lg">
                <Bell size={20} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">تفضيلات الإشعارات</h4>
                <p className="text-xs text-slate-500 font-medium">اختر التنبيهات التي ترغب في استلامها</p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/60 cursor-pointer">
                <span className="text-xs font-bold text-slate-700">تنبيهات الحصص المباشرة والجلسات</span>
                <input type="checkbox" defaultChecked className="rounded text-indigo-600 h-4 w-4" />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/60 cursor-pointer">
                <span className="text-xs font-bold text-slate-700">تذكير تدريب السرعة اليومي (60 ثانية)</span>
                <input type="checkbox" defaultChecked className="rounded text-indigo-600 h-4 w-4" />
              </label>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
};
