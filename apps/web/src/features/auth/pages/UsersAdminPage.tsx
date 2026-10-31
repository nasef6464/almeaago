import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Filter,
  GraduationCap,
  Loader2,
  Lock,
  MoreVertical,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react';

import { useAuth } from '../state/AuthProvider';
import { authClient } from '../api/auth-client';
import type { AdminUser, AdminUsersSummary, UserRole } from '../api/auth-types';
import { organizationsClient, type SchoolSummary } from '../../organizations/api/organizations-client';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyCore } from '../../content/api/content-types';

interface UsersAdminPageProps {
  defaultRoleFilter?: string;
  pageTitle?: string;
}

const roleLabels: Record<string, string> = {
  all: 'كافة الأدوار',
  student: 'طالب',
  teacher: 'معلم / مدرب',
  school_teacher: 'معلم مدرسة',
  platform_trainer: 'مدرب منصة',
  supervisor: 'مشرف',
  school_admin: 'مدير مدرسة',
  parent: 'ولي أمر',
  admin: 'مدير المنصة',
};

export function UsersAdminPage({ defaultRoleFilter = 'all', pageTitle }: UsersAdminPageProps) {
  const { user, getCsrfToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(
    searchParams.get('role') || defaultRoleFilter
  );
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<AdminUsersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  // Auxiliary metadata for scopes
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyCore>({ paths: [], subjects: [] });

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    nationalId: '',
    phone: '',
    role: (defaultRoleFilter === 'platform_trainer' || defaultRoleFilter === 'school_teacher' ? 'teacher' : defaultRoleFilter === 'all' ? 'student' : defaultRoleFilter) as UserRole,
    trainerType: defaultRoleFilter === 'school_teacher' ? 'school_teacher' : 'platform_trainer',
    schoolId: '',
    managedPathIds: [] as string[],
    managedSubjectIds: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    role: UserRole;
    isActive: boolean;
    schoolId: string;
    managedPathIds: string[];
    managedSubjectIds: string[];
  }>({
    name: '',
    role: 'student',
    isActive: true,
    schoolId: '',
    managedPathIds: [],
    managedSubjectIds: [],
  });

  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  // Load auxiliary schools and taxonomy once
  useEffect(() => {
    organizationsClient.schools().then((res) => setSchools(res.schools || [])).catch(() => {});
    contentClient.taxonomyCore().then(setTaxonomy).catch(() => {});
  }, []);

  // Load Users List and Summary
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const query: { page: number; limit: number; role?: string; search?: string; isActive?: boolean; platformTrainer?: boolean } = {
      page,
      limit,
      search: searchTerm.trim() || undefined,
    };

    if (roleFilter === 'platform_trainer') {
      query.role = 'teacher';
      query.platformTrainer = true;
    } else if (roleFilter === 'school_teacher') {
      query.role = 'teacher';
    } else if (roleFilter !== 'all') {
      query.role = roleFilter;
    }

    if (activeFilter === 'active') query.isActive = true;
    if (activeFilter === 'inactive') query.isActive = false;

    Promise.all([
      authClient.adminListUsers(query),
      authClient.adminUsersSummary().catch(() => null),
    ])
      .then(([res, summaryRes]) => {
        if (!active) return;
        setUsers(res.users || []);
        setPagination({
          total: res.pagination.total,
          totalPages: Math.max(1, res.pagination.totalPages),
        });
        if (summaryRes) setSummary(summaryRes);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'تعذر تحميل المستخدمين');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeFilter, limit, page, reload, roleFilter, searchTerm]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email || createForm.password.length < 6) {
      setError('يرجى ملء الاسم والبريد الإلكتروني وكلمة مرور لا تقل عن 6 أحرف.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const csrf = await getCsrfToken();
      const payload: Record<string, unknown> = {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        nationalId: createForm.nationalId.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
      };

      if (createForm.role === 'teacher') {
        if (createForm.trainerType === 'school_teacher') {
          payload.schoolId = createForm.schoolId || null;
        } else {
          payload.managedPathIds = createForm.managedPathIds;
          payload.managedSubjectIds = createForm.managedSubjectIds;
        }
      }

      await authClient.adminCreateUser(payload, csrf);
      setNotice('تم إنشاء المستخدم بنجاح.');
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        nationalId: '',
        phone: '',
        role: 'student',
        trainerType: 'platform_trainer',
        schoolId: '',
        managedPathIds: [],
        managedSubjectIds: [],
      });
      setReload((x) => x + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsSubmitting(true);
      setError('');
      const csrf = await getCsrfToken();
      await authClient.adminUpdateUser(
        editingUser.id,
        {
          name: editForm.name,
          role: editForm.role,
          isActive: editForm.isActive,
          schoolId: editForm.schoolId || null,
          managedPathIds: editForm.managedPathIds,
          managedSubjectIds: editForm.managedSubjectIds,
        },
        csrf
      );
      setNotice('تم تحديث بيانات المستخدم بنجاح.');
      setEditingUser(null);
      setReload((x) => x + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث بيانات المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (targetUser: AdminUser) => {
    try {
      const csrf = await getCsrfToken();
      await authClient.adminUpdateUser(
        targetUser.id,
        { isActive: !targetUser.isActive },
        csrf
      );
      setNotice(
        targetUser.isActive
          ? `تم إيقاف حساب ${targetUser.name}.`
          : `تم تفعيل حساب ${targetUser.name}.`
      );
      setReload((x) => x + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تغيير حالة الحساب');
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      setIsSubmitting(true);
      const csrf = await getCsrfToken();
      await authClient.adminDeleteUser(deletingUser.id, csrf);
      setNotice(`تم حذف حساب ${deletingUser.name} بنجاح.`);
      setDeletingUser(null);
      setReload((x) => x + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      schoolId: u.schoolId || '',
      managedPathIds: u.managedPathIds || [],
      managedSubjectIds: u.managedSubjectIds || [],
    });
  };

  const resolveBadge = (u: AdminUser) => {
    switch (u.role) {
      case 'admin':
        return <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">مدير المنصة</span>;
      case 'supervisor':
        return <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-black text-purple-700">مشرف</span>;
      case 'school_admin':
        return <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">مدير مدرسة</span>;
      case 'teacher': {
        const isPlatform = (u.managedPathIds?.length || 0) > 0 || (u.managedSubjectIds?.length || 0) > 0;
        const isSchool = Boolean(u.schoolId);
        if (isPlatform && isSchool) {
          return <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-800">مدرب منصة + معلم مدرسة</span>;
        }
        if (isPlatform) {
          return <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700">مدرب منصة</span>;
        }
        return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">معلم مدرسة</span>;
      }
      case 'parent':
        return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">ولي أمر</span>;
      case 'student':
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">طالب</span>;
    }
  };

  const title = pageTitle || (defaultRoleFilter === 'platform_trainer' || defaultRoleFilter === 'school_teacher' ? 'إدارة المدربين والمعلمين' : 'إدارة المستخدمين');

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-16 font-sans">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-indigo-200">
              <Users size={14} className="text-amber-400" />
              <span>USER & ROLE MANAGEMENT</span>
            </div>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h1>
            <p className="mt-1 text-xs font-bold text-indigo-200 sm:text-sm">
              إدارة حسابات الطلاب، المعلمين والمدربين، مدراء المدارس، والمشرفين والتحكم بصلاحيات الوصول.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setReload((x) => x + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black text-white hover:bg-white/20 transition"
            >
              <RefreshCcw size={15} />
              <span>تحديث</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-amber-400 transition"
            >
              <Plus size={16} />
              <span>إضافة مستخدم جديد</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">{notice}</div>}

      {/* KPI Stats */}
      {summary && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400">إجمالي الحسابات</span>
            <div className="mt-1 text-2xl font-black text-slate-900">{summary.total}</div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400">الطلاب</span>
            <div className="mt-1 text-2xl font-black text-indigo-600">{summary.byRole['student'] || 0}</div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400">المعلمون والمدربون</span>
            <div className="mt-1 text-2xl font-black text-emerald-600">{summary.byRole['teacher'] || 0}</div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400">أولياء الأمور</span>
            <div className="mt-1 text-2xl font-black text-amber-600">{summary.byRole['parent'] || 0}</div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400">حسابات متوقفة</span>
            <div className="mt-1 text-2xl font-black text-rose-600">{summary.inactive}</div>
          </div>
        </section>
      )}

      {/* Filter and Search Bar */}
      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="ابحث بالاسم، البريد الإلكتروني، رقم الجوال أو الهوية..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-2xl border border-gray-200 bg-slate-50 py-2.5 pl-4 pr-11 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="تصفية حسب الدور"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-xs focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="all">كافة الأدوار</option>
              <option value="student">الطلاب</option>
              <option value="teacher">كافة المعلمين والمدربين</option>
              <option value="platform_trainer">مدربو المنصة فقط</option>
              <option value="school_teacher">معلمو المدارس فقط</option>
              <option value="supervisor">المشرفون</option>
              <option value="school_admin">مدراء المدارس</option>
              <option value="parent">أولياء الأمور</option>
              <option value="admin">مدراء المنصة</option>
            </select>
            <select
              aria-label="تصفية حسب الحالة"
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value as any);
                setPage(1);
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-xs focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="all">كل الحالات</option>
              <option value="active">الحسابات النشطة</option>
              <option value="inactive">الحسابات المتوقفة</option>
            </select>
          </div>
        </div>
      </section>

      {/* Users Table */}
      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-16 font-bold text-slate-400">
            <Loader2 size={24} className="animate-spin text-indigo-600" />
            <span>جاري تحميل بيانات المستخدمين...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-slate-400 font-bold space-y-2">
            <Users size={40} className="mx-auto text-slate-300" />
            <p className="text-base text-slate-700">لم يتم العثور على مستخدمين يطابقون خيارات البحث.</p>
            <p className="text-xs">جرّب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-gray-100 bg-slate-50/70 text-slate-500">
                <tr>
                  <th className="p-4 font-black">المستخدم</th>
                  <th className="p-4 font-black">الدور والتصنيف</th>
                  <th className="p-4 font-black">الانتماء / النطاق</th>
                  <th className="p-4 font-black">الهوية / الجوال</th>
                  <th className="p-4 font-black">الحالة</th>
                  <th className="p-4 font-black text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const schoolName = schools.find((s) => s.id === u.schoolId)?.name;
                  const managedPaths = taxonomy.paths.filter((p) => u.managedPathIds?.includes(p.id)).map((p) => p.name);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-black text-indigo-700">
                            {u.name.slice(0, 1)}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 block">{u.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{resolveBadge(u)}</td>
                      <td className="p-4">
                        {schoolName ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 font-bold">
                            <Building2 size={13} className="text-indigo-500" />
                            {schoolName}
                          </span>
                        ) : managedPaths.length > 0 ? (
                          <span className="text-[11px] text-indigo-700 font-bold">
                            مسارات: {managedPaths.join('، ')}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-0.5 font-mono text-[11px] text-slate-600">
                          {u.nationalId ? <div>هوية: {u.nationalId}</div> : null}
                          {u.phone ? <div>جوال: {u.phone}</div> : null}
                          {!u.nationalId && !u.phone && <span className="text-slate-400 font-sans">—</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => void toggleStatus(u)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black cursor-pointer transition ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {u.isActive ? <UserCheck size={12} /> : <UserX size={12} />}
                          <span>{u.isActive ? 'نشط' : 'متوقف'}</span>
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="rounded-lg border border-gray-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                            title="تعديل المستخدم"
                          >
                            <Edit2 size={13} />
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => setDeletingUser(u)}
                              className="rounded-lg border border-gray-200 bg-white p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="حذف الحساب"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-xs font-bold text-slate-500">
          <div>
            صفحة {page} من {pagination.totalPages} (إجمالي: {pagination.total} مستخدم)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-slate-700 disabled:opacity-40"
            >
              <ChevronRight size={14} />
              السابق
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-slate-700 disabled:opacity-40"
            >
              التالي
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsCreateOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-black text-slate-900">إضافة مستخدم جديد</h2>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">الاسم الكامل *</label>
                <input
                  required
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold"
                  placeholder="محمد أحمد..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">البريد الإلكتروني *</label>
                  <input
                    required
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold font-mono"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">كلمة المرور *</label>
                  <input
                    required
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold font-mono"
                    placeholder="لا تقل عن 6 أحرف"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">الدور الأساسي</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold"
                  >
                    <option value="student">طالب</option>
                    <option value="teacher">معلم / مدرب</option>
                    <option value="parent">ولي أمر</option>
                    <option value="school_admin">مدير مدرسة</option>
                    <option value="supervisor">مشرف</option>
                    <option value="admin">مدير المنصة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">رقم الجوال</label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold font-mono"
                    placeholder="05xxxxxxxx"
                  />
                </div>
              </div>

              {/* Extra scope if teacher */}
              {createForm.role === 'teacher' && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-3">
                  <div className="text-xs font-black text-indigo-900">نطاق عمل المعلم / المدرب</div>
                  <div className="flex gap-4 text-xs font-bold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="trainerType"
                        checked={createForm.trainerType === 'platform_trainer'}
                        onChange={() => setCreateForm({ ...createForm, trainerType: 'platform_trainer' })}
                      />
                      <span>مدرب منصة</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="trainerType"
                        checked={createForm.trainerType === 'school_teacher'}
                        onChange={() => setCreateForm({ ...createForm, trainerType: 'school_teacher' })}
                      />
                      <span>معلم مدرسة</span>
                    </label>
                  </div>
                  {createForm.trainerType === 'school_teacher' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">المدرسة التابع لها</label>
                      <select
                        value={createForm.schoolId}
                        onChange={(e) => setCreateForm({ ...createForm, schoolId: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-white p-2 text-xs font-bold"
                      >
                        <option value="">اختر المدرسة</option>
                        {schools.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {createForm.trainerType === 'platform_trainer' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">المسارات المسندة</label>
                      <select
                        multiple
                        value={createForm.managedPathIds}
                        onChange={(e) => setCreateForm({ ...createForm, managedPathIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                        className="w-full rounded-xl border border-gray-200 bg-white p-2 text-xs font-bold h-24"
                      >
                        {taxonomy.paths.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'إنشاء المستخدم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setEditingUser(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-black text-slate-900">تعديل بيانات {editingUser.name}</h2>
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">الاسم</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">الدور</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold"
                  >
                    <option value="student">طالب</option>
                    <option value="teacher">معلم / مدرب</option>
                    <option value="parent">ولي أمر</option>
                    <option value="school_admin">مدير مدرسة</option>
                    <option value="supervisor">مشرف</option>
                    <option value="admin">مدير المنصة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">حالة الحساب</label>
                  <select
                    value={editForm.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'active' })}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold"
                  >
                    <option value="active">نشط</option>
                    <option value="inactive">متوقف</option>
                  </select>
                </div>
              </div>

              {editForm.role === 'teacher' && (
                <div className="space-y-3 rounded-2xl border bg-slate-50 p-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">المدرسة المسندة (إن وجدت)</label>
                    <select
                      value={editForm.schoolId}
                      onChange={(e) => setEditForm({ ...editForm, schoolId: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 bg-white p-2 text-xs font-bold"
                    >
                      <option value="">لا توجد مدرسة (مدرب منصة مستقل)</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">المسارات المسندة</label>
                    <select
                      multiple
                      value={editForm.managedPathIds}
                      onChange={(e) => setEditForm({ ...editForm, managedPathIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                      className="w-full rounded-xl border border-gray-200 bg-white p-2 text-xs font-bold h-24"
                    >
                      {taxonomy.paths.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setDeletingUser(null)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900">تأكيد حذف الحساب</h3>
              <p className="mt-1 text-xs text-slate-500 font-bold leading-5">
                هل أنت متأكد من حذف حساب <span className="text-slate-900 font-black">«{deletingUser.name}»</span>؟ لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDelete}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isSubmitting ? 'جاري الحذف...' : 'نعم، حذف الحساب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
