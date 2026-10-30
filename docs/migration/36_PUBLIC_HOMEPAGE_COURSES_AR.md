# PUBLIC-HOMEPAGE-COURSES-01 — بطاقات الدورات الحقيقية بدل بطاقات العرض الوهمية

## المصدر والقرار
- Legacy READ ONLY: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`، `pages/Landing.tsx` (publishedCourses, featuredCourses, course card).
- Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- المشكلة المؤكدة: `PublicLandingPage.tsx` تعرض ثلاث صور ثابتة من `PLATFORM_DAYLIGHT_IMAGES` تحت عنوان «الدورات الأكثر طلبًا»، وتعرض ملاحظة «هذه بطاقات عرض للواجهة المرجعية» وزر «استكشف»، بينما الأصل يعرض الدورات المنشورة الفعلية وزري «معاينة» و«شراء». كما تعرض أسماء مسارات وهمية عند فراغ الاستجابة.
- نطاق مستقل لا يمس ملفات #159 (header) أو #160 (skills) أو #158 (header/commerce public catalog). لا تغييرات في Legacy أو الإنتاج.

## المسار التنفيذي
1. زائر `/` → `GET /api/v1/courses/public?limit=100` دون جلسة.
2. Go `contenthttp.NewCourses` → `contentapp.Service.PublicCourses` → `postgres.Repository.ListPublicCourses`.
3. PostgreSQL `courses` مع `paths` و`subjects` و`assets`: شروط `approved AND is_published AND is_visible`، مسار ومادة نشطان، و`owner_type='platform'` لمنع كشف المحتوى المدرسي دون عقد نشر عام. صورة الأصل تُقرأ من `assets.public_url` فقط عندما يكون الأصل نشطًا.
4. Frontend يستهلك حقولًا عامة فقط (id/title/instructorName/thumbnailUrl)، ويختار حتى ثلاث دورات من `featuredCourseIds` المحفوظة إن كانت منشورة، وإلا أول ثلاث من القائمة. لا تعرض بطاقات مصطنعة أو بيانات معلم/سعر/تقييم مختلقة.
5. روابط المعاينة والشراء تحافظ على `/course/:id` و`?buy=1` الظاهريين من Legacy؛ **التفعيل التجاري الفعلي لهذه الإشارة غير مثبت**، ولا يجوز ادعاؤه. رابط «عرض الكل» يذهب إلى `/learning` لأن `/courses` غير معرّف في Go main.

## الاختبارات المطلوبة
- E2E ضيف عند 390/820/1440: الدورات الحقيقية فقط، عدم ظهور صور preview الوهمية، روابط المعاينة/الشراء، عدم overflow، screenshots.
- E2E: HTTP 503 لا يتحول إلى بطاقات وهمية؛ بعد reload واستجابة فارغة تظهر «لا توجد دورات منشورة حاليًا».
- Go HTTP: قراءة عامة بلا Auth ورفض limit غير صالح.
- Go application: حدود limit وdelegation.
- PostgreSQL isolated opt-in (`ALMEAA_ISOLATED_POSTGRES=1`, `DATABASE_URL`): اختبارات منع تسرب draft/unpublished/invisible/school/inactive path/subject.
- CI الأربع على SHA النهائي؛ لا شهادة تطابق بصري دون صور Legacy↔Go بنفس الدور والبيانات.

## المتبقي صراحة — PARTIAL
- ترتيب الشعبية في Legacy يستخدم جمهور الدورة والتقييم؛ Go حاليًا يرتب بالنشر/التحديث لغياب read model عام معتمد للجمهور/التقييم.
- السعر/الخصم وصورة CDN والأهلية التجارية وربط `?buy=1` إلى checkout تحتاج عقد Commerce؛ #158 يملك ملفات التجارة العامة. لا تخترع أسعارًا.
- تمييز `showInHome` و`showOnPlatform` لكل مسار/دورة في المصدر يحتاج عقد taxonomy/publication كامل؛ الحالي يقيّد approved/published/visible/active/platform فقط.
- المقالات والإحصاءات الديناميكية والصفحة الكاملة، والصور المقترنة مع Legacy، ما زالت PARTIAL.
- لا دمج أو نشر أو cutover دون قرار منفصل.
