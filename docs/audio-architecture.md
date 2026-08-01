# Audio System Architecture

> **الإصدار:** v253 — المرحلة 18  
> **تاريخ التوثيق:** 2026-07-05  
> **الحالة:** نظام مكتمل بدون Download Manager (مرحلة مستقبلية)

---

## 1. نظرة عامة على النظام

نظام `src/lib/audio/` هو طبقة إدارة المحتوى الصوتي بالكامل داخل التطبيق. هدفه الرئيسي هو:

- **اكتشاف المحتوى:** قراءة الكتالوج المتاح من Cloudflare R2 (أو محلياً) وعرض قائمة الحزم الصوتية.
- **إدارة التثبيت:** تخزين الحزم المُثبَّتة على جهاز المستخدم وتسجيل حالتها.
- **التحقق من الصحة:** فحص سلامة الحزم قبل تثبيتها.
- **تتبع الحالة:** تمثيل حالة كل حزمة (لم تُثبَّت / جارٍ التحميل / مُثبَّتة / ...) بشكل آمن عبر State Machine.

النظام مصمم بمبدأ **Separation of Concerns** الصارم: كل طبقة تعرف مسؤوليتها فقط ولا تتجاوزها.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        UI / Screens                         │
│              (شاشات React Native فقط)                       │
└────────────────────────────┬────────────────────────────────┘
                             │  استدعاءات عبر AudioRepository فقط
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    AudioRepository                          │
│              (Facade — نقطة الدخول الوحيدة)                 │
│  ينسّق: Storage + Registry + Catalog + Validator            │
└──────┬──────────────┬──────────────┬────────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│AudioStorage  │ │RegistryService│ │    CatalogService         │
│(ملفات فقط)  │ │(JSON فقط)    │ │  (قراءة الكتالوج فقط)    │
│              │ │              │ │                            │
│expo-file-    │ │installed.json│ │          ▼                 │
│system        │ │              │ │    CatalogSource           │
└──────────────┘ └──────────────┘ │    (Interface)             │
                                  │    /          \            │
                                  │   ▼            ▼           │
                                  │ Local      Cloudflare      │
                                  │ Source     CatalogSource   │
                                  └──────────────────────────--┘

┌──────────────────────────────┐  ┌──────────────────────────┐
│     PackageValidator         │  │   PackageStateMachine     │
│  (مستقل تماماً — تحقق فقط)  │  │  (مستقل — حالات فقط)     │
└──────────────────────────────┘  └──────────────────────────┘
```

**مسارات الاعتماد المسموح بها:**

```
UI → AudioRepository → AudioStorage
                    → RegistryService
                    → CatalogService → CatalogSource
                    → PackageValidator (عند الحاجة)

PackageStateMachine ← UI مباشرة (لا يحتاج Repository)
```

**ممنوع منعاً باتاً:**

```
UI → AudioStorage           ✗
UI → RegistryService        ✗
CatalogService → Repository ✗  (بعد المرحلة 17)
AudioStorage → Registry     ✗  (بعد المرحلة 17)
```

---

## 3. مسؤولية كل طبقة

### AudioRepository
| | |
|---|---|
| **المسؤولية** | Facade موحّد ينسّق جميع العمليات |
| **يعرف** | AudioStorage، RegistryService، CatalogService |
| **لا يجب أن يعرف** | تفاصيل FileSystem، بنية JSON الداخلية للـ Registry |
| **الدور الخاص** | المنسّق الوحيد بين Storage وRegistry — يكتب الملفات أولاً ثم يسجّل في Registry |

### AudioStorageService
| | |
|---|---|
| **المسؤولية** | إنشاء/قراءة/حذف الملفات والمجلدات على الجهاز |
| **يعرف** | `expo-file-system`، `StorageLayout`، `InstalledPackageInfo` |
| **لا يجب أن يعرف** | RegistryService، CatalogService، Repository، أي شبكة |
| **الدور الخاص** | يكتب `manifest.json` داخل مجلد الحزمة فقط — لا يسجّل في Registry |

### RegistryService
| | |
|---|---|
| **المسؤولية** | قراءة وكتابة `installed.json` — فهرس الحزم المُثبَّتة |
| **يعرف** | نوع `InstalledPackageInfo` من audio-storage.ts (type فقط) |
| **لا يجب أن يعرف** | AudioStorage، AudioRepository، FileSystem (إلا لـ JSON)، أي شبكة |
| **الدور الخاص** | صلاحية واحدة: إدارة قائمة `installed.json` |

### CatalogService
| | |
|---|---|
| **المسؤولية** | قراءة الكتالوج من `CatalogSource` وتصفيته وترتيبه |
| **يعرف** | `CatalogSource` interface، أنواع `audio-manifest.ts` |
| **لا يجب أن يعرف** | AudioRepository، AudioStorage، RegistryService، FileSystem |
| **الدور الخاص** | Dependency Injection عبر CatalogSource — المصدر قابل للاستبدال |

### PackageValidator
| | |
|---|---|
| **المسؤولية** | التحقق من صحة الحزمة قبل تثبيتها (manifest + هيكل + checksum + إصدار) |
| **يعرف** | أنواع `audio-manifest.ts`، `StorageLayout`، `expo-file-system` (قراءة فقط) |
| **لا يجب أن يعرف** | Repository، Registry، CatalogService، أي شبكة |
| **الدور الخاص** | مستقل بالكامل — يُستدعى من Repository كخطوة في Pipeline التثبيت |

### PackageStateMachine
| | |
|---|---|
| **المسؤولية** | تتبع حالة كل حزمة في الذاكرة + التحقق من صحة الانتقالات |
| **يعرف** | `AudioType` و`PackageState` فقط |
| **لا يجب أن يعرف** | أي service آخر في النظام |
| **الدور الخاص** | UI يقرأ الحالة منه مباشرة — لا يمر عبر Repository |

### CloudflareCatalogSource
| | |
|---|---|
| **المسؤولية** | جلب `index.json` من Cloudflare R2 وتحليله |
| **يعرف** | `CatalogSource` interface، نوع `Manifest` |
| **لا يجب أن يعرف** | CatalogService، Repository، أي شيء آخر |
| **الدور الخاص** | يُنفّذ `CatalogSource` فقط — قابل للاستبدال |

---

## 4. Storage Layout

الهيكل الكامل لمجلد التخزين داخل `documentDirectory`:

```
documentDirectory/
└── audio/
    ├── packages/
    │   ├── adhan/
    │   │   └── {id}/                     ← مثال: adhan-mishari-afasy/
    │   │       ├── manifest.json          ← InstalledPackageInfo للحزمة
    │   │       ├── assets/
    │   │       │   ├── thumbnail.webp     ← صورة مصغّرة (اختيارية)
    │   │       │   ├── cover.webp         ← صورة كبيرة (اختيارية)
    │   │       │   └── license.txt        ← نص الرخصة (اختياري)
    │   │       └── audio/
    │   │           └── *.mp3 / *.m4a      ← ملفات الصوت الفعلية
    │   ├── quran/
    │   │   └── {id}/...
    │   ├── ruqyah/
    │   ├── dua/
    │   ├── notification/
    │   └── custom/
    ├── cache/                             ← ملفات مؤقتة للتحميل (TODO)
    └── temp/                             ← ملفات ZIP قبل الاستخراج (TODO)
```

**`manifest.json` المحلي** (داخل كل حزمة مُثبَّتة):

يحتوي على `InstalledPackageInfo` — بيانات التثبيت المحلية فقط: id، type، version، installedAt، checksum، sizeBytes، state. يتيح قراءة بيانات الحزمة بدون إنترنت.

**`installed.json`** (فهرس مركزي على مستوى النظام):

يحتوي على `InstalledRegistry` — قائمة بجميع الحزم المُثبَّتة مع schemaVersion. يُتحقق من وجوده عند كل عملية تثبيت أو حذف.

---

## 5. Manifest Schema

ملف `index.json` على Cloudflare R2 يتبع نوع `Manifest`. فيما يلي هدف كل مجموعة من الحقول:

### حقول رأس الملف
| الحقل | الهدف |
|-------|-------|
| `schemaVersion` | يحدد بنية الملف — يتغيّر فقط عند تغيير هيكل JSON نفسه |
| `catalogVersion` | رقم تسلسلي يزداد مع كل نشر — يُستخدم للكشف عن وجود تحديثات جديدة |
| `generatedAt` | وقت بناء الملف — للتشخيص والـ caching |
| `minimumSupportedAppVersion` | أقدم إصدار تطبيق يستطيع قراءة هذا الملف — يمنع كسر الإصدارات القديمة |
| `totalPackages` | للتحقق السريع من اكتمال الملف دون تعداد المصفوفة |
| `categories` | قائمة تصنيفات المحتوى بترتيب sortOrder لعرض التبويبات |
| `packages` | قائمة جميع الحزم المتاحة بترتيب sortOrder |

### حقول الحزمة (`AudioPackage`)
| المجموعة | الحقول | الهدف |
|---------|--------|-------|
| **الهوية** | `id`, `type`, `folderName`, `manifestUrl?` | تعريف الحزمة بشكل فريد ودائم — id لا يتغيّر أبداً |
| **المحتوى** | `title`, `description?`, `author`, `authorUrl?`, `language`, `origin` | بيانات العرض للمستخدم — title من نوع LocalizedString (ar + en) |
| **الإصدار** | `version`, `releaseDate`, `updatedAt`, `minimumAppVersion` | إدارة التحديثات ومنع التثبيت على إصدارات غير متوافقة |
| **الملفات** | `checksum`, `sizeBytes`, `compressedSizeBytes?`, `downloadUrl?`, `previewUrl?`, `thumbnailUrl?`, `durationSeconds?` | بيانات التحميل والتحقق والعرض قبل التثبيت |
| **التثبيت** | `builtIn`, `manifestChecksum?` | builtIn=true يعني لا تحميل — موجودة في التطبيق |
| **الاكتشاف** | `tags`, `featured`, `sortOrder` | تصفية البحث وترتيب العرض والعرض في الواجهة الرئيسية |
| **الجودة** | `verified`, `license` | شارة التحقق ورخصة الاستخدام |
| **دورة الحياة** | `deprecated`, `replacementId?` | هجر الحزمة القديمة وتوجيه المستخدم للبديل |
| **قابلية التوسع** | `metadata` | حقل مرن يحتوي بيانات خاصة بكل نوع دون تعديل Schema |

### حقول التصنيف (`Category`)
| الحقل | الهدف |
|-------|-------|
| `id` | يطابق `AudioType` تماماً ("adhan", "quran", ...) |
| `title`, `description` | نص العرض من نوع `LocalizedString` |
| `iconUrl?` | أيقونة التصنيف في واجهة التبويبات |
| `sortOrder` | ترتيب ظهور التصنيف في الواجهة |
| `enabled` | تفعيل/إخفاء التصنيف بدون حذفه |

---

## 6. Registry

### ما هو `installed.json`؟

ملف JSON يعيش داخل `audio/` بجانب مجلد `packages/`. يحتفظ بقائمة جميع الحزم المُثبَّتة على الجهاز في لحظة معيّنة.

```
audio/
├── installed.json   ← الفهرس المركزي
└── packages/
    └── ...
```

**بنيته:**
```json
{
  "schemaVersion": "1.0.0",
  "packages": [
    {
      "id": "adhan-mishari-afasy",
      "type": "adhan",
      "version": "1.0.0",
      "installedAt": "2026-07-05T10:00:00Z",
      "checksum": "sha256:abc123...",
      "state": "INSTALLED",
      ...
    }
  ]
}
```

### متى يتم تحديثه؟

| العملية | من يُحدّثه | متى؟ |
|---------|------------|------|
| تثبيت حزمة | `AudioRepository` عبر `registryService.addOrUpdatePackage()` | بعد نجاح كتابة الملفات في Storage |
| حذف حزمة | `AudioRepository` عبر `registryService.removePackage()` | بعد نجاح حذف الملفات من Storage |
| تحديث حزمة | `AudioRepository` (نفس `addOrUpdatePackage`) | يحدّث الإدخال الموجود بدلاً من إضافة جديد |

**مبدأ مهم:** Storage يكتب الملفات، وRepository يُقرّر متى يُحدَّث Registry. لا يتواصل Storage مع Registry مباشرة.

---

## 7. Repository — لماذا نقطة الدخول الوحيدة؟

### المشكلة التي يحلّها

بدون Repository، سيضطر الـ UI إلى:
1. استدعاء `audioStorage.installLocalPackage()` بنفسه.
2. ثم استدعاء `registryService.addOrUpdatePackage()` بنفسه.
3. ثم التعامل مع أخطاء كل منهما بشكل مستقل.

هذا يعني أن منطق التنسيق سينتشر في أماكن متعددة في الـ UI، وأي تغيير مستقبلي في ترتيب العمليات يستلزم تعديل كل شاشة.

### الحل

```
UI يستدعي: audioRepository.installLocalPackage(info)

Repository ينسّق:
  1. audioStorage.installLocalPackage(info)   → كتابة الملفات
  2. registryService.addOrUpdatePackage(info) → تسجيل في الفهرس
  3. إعادة نتيجة موحّدة: AudioRepositoryResult<void>
```

### الفوائد

- **تغليف:** UI لا يعرف أن هناك Storage وRegistry منفصلَين.
- **اتساق:** كل عملية تُحاط بـ `try/catch` وتُعيد `AudioRepositoryResult<T>`.
- **مرونة:** إضافة خطوة جديدة للتثبيت (مثل تحديث StateMachine) تتم في مكان واحد.
- **اختبار:** يمكن استبدال Storage أو Registry بـ mock في الاختبارات دون لمس الـ UI.

---

## 8. Catalog — Dependency Injection

### المبدأ

`CatalogService` لا يعرف من أين تأتي البيانات. يتلقّاها عبر `CatalogSource`:

```typescript
interface CatalogSource {
  getCatalog(): Promise<Manifest>;
}
```

### كيف يعمل

```
CatalogService(source: CatalogSource = new LocalCatalogSource())
                                              ↑
                          القيمة الافتراضية أثناء التطوير
```

عند التشغيل الفعلي:
```typescript
const service = new CatalogService(new CloudflareCatalogSource());
```

### قواعد الاستبدال

| السيناريو | المصدر |
|---------|--------|
| تطوير محلي / اختبار | `LocalCatalogSource` (يقرأ `SAMPLE_MANIFEST`) |
| إنتاج | `CloudflareCatalogSource` (يجلب من R2) |
| مستقبلاً: CDN آخر | أنشئ class يُنفّذ `CatalogSource` فقط |

**لا يتغيّر** `CatalogService` عند استبدال المصدر. كل الدوال (getPackages، getCategories، getFeaturedPackages...) تعمل بدون تعديل.

### مقارنة الكتالوج بالمثبت

دالة `compareWithInstalled()` انتقلت في المرحلة 17 إلى `AudioRepository`. هذا صحيح معمارياً لأن Repository هو الوحيد الذي يعرف كلاً من:
- الحزم المتاحة (عبر CatalogService).
- الحزم المُثبَّتة (عبر RegistryService).

---

## 9. Validator

### ماذا يتحقق؟

| الفحص | التفاصيل |
|-------|---------|
| **manifest header** | schemaVersion، catalogVersion، generatedAt، totalPackages، packages غير فارغة |
| **package fields** | id، type، version (semver)، language (BCP47)، sizeBytes > 0، license صالحة |
| **folder structure** | وجود مجلد الحزمة + مجلد audio/ + مجلد assets/ بعد الاستخراج |
| **checksum** | مقارنة SHA-256 للملفات بالقيمة في manifest (TODO: يحتاج تنفيذ كامل) |
| **version compatibility** | مقارنة `minimumAppVersion` بإصدار التطبيق الحالي |
| **category** | أن `type` موجود ضمن قائمة `AudioType` المدعومة |

### متى يُستخدم؟

في Pipeline التثبيت داخل `AudioRepository`:

```
Download → [Validate] → Extract → Install → Registry
                ↑
          يُستدعى هنا
```

إذا فشل الفحص: يتوقف Pipeline كاملاً قبل كتابة أي ملف.

### لماذا هو مستقل؟

Validator لا يكتب ولا يحذف. يقرأ فقط ويُعيد `PackageValidationResult`. هذا يجعله:
- قابلاً للاستخدام في أي مكان دون آثار جانبية.
- سهل الاختبار باستقلالية كاملة.
- آمناً للاستدعاء المتكرر.

---

## 10. State Machine

### الحالات

```
NOT_INSTALLED → DOWNLOADING → DOWNLOADED → VALIDATING → INSTALLING → INSTALLED
                    ↓                           ↓              ↓
                  FAILED                    CORRUPTED        FAILED
                    ↓                           ↓
              DOWNLOADING               DOWNLOADING
              NOT_INSTALLED             NOT_INSTALLED

INSTALLED → UPDATE_AVAILABLE → DOWNLOADING → ...
```

| الحالة | المعنى |
|--------|--------|
| `NOT_INSTALLED` | الحزمة غير مُثبَّتة — الحالة الابتدائية |
| `DOWNLOADING` | جارٍ تحميل ملف ZIP — يعرض progress bar |
| `DOWNLOADED` | اكتمل التحميل — في انتظار التحقق |
| `VALIDATING` | جارٍ فحص checksum والهيكل |
| `INSTALLING` | جارٍ استخراج ZIP وكتابة الملفات |
| `INSTALLED` | مُثبَّتة وجاهزة للتشغيل |
| `UPDATE_AVAILABLE` | مُثبَّتة لكن الكتالوج يحتوي إصداراً أحدث |
| `FAILED` | فشل التحميل أو التثبيت — يمكن إعادة المحاولة |
| `CORRUPTED` | فشل التحقق من checksum — بيانات تالفة |

### مبدأ الانتقالات

كل انتقال يمر عبر `ALLOWED_TRANSITIONS`:

```typescript
NOT_INSTALLED    → [DOWNLOADING]
DOWNLOADING      → [DOWNLOADED, FAILED]
DOWNLOADED       → [VALIDATING, INSTALLING]
VALIDATING       → [INSTALLING, FAILED, CORRUPTED]
INSTALLING       → [INSTALLED, FAILED]
INSTALLED        → [UPDATE_AVAILABLE]
UPDATE_AVAILABLE → [DOWNLOADING]
FAILED           → [DOWNLOADING, NOT_INSTALLED]
CORRUPTED        → [DOWNLOADING, NOT_INSTALLED]
```

أي انتقال خارج هذه القائمة يُرفض فوراً بـ `Error`. هذا يمنع حالات غير منطقية مثل الانتقال من `INSTALLED` مباشرة إلى `CORRUPTED`.

### لماذا لا تعرف Storage أو Repository؟

State Machine تعيش في **ذاكرة التطبيق فقط** (`Map<string, PackageStatus>`). إنها لا تكتب ملفات ولا تقرأها. فصلها عن Storage يعني:
- يمكن إعادة تشغيل التطبيق وإعادة بناء الحالات من Registry.
- يمكن محاكاة أي حالة في الاختبارات بدون ملفات فعلية.
- لا تأثير جانبي عند تغيير الحالة في الذاكرة.

---

## 11. Download Pipeline (Design Only)

> هذا القسم تصميم مستقبلي — لا يوجد كود حالياً.

عند تنفيذ Download Manager، ستمر العملية بالمراحل التالية:

```
┌─────────────────────────────────────────────────────────────┐
│                    Download Pipeline                         │
│              (ينفّذه AudioRepository مستقبلاً)               │
└─────────────────────────────────────────────────────────────┘

  المدخل: AudioPackage (من الكتالوج)

  1. DOWNLOAD
     ├── تحديث StateMachine: NOT_INSTALLED → DOWNLOADING
     ├── تحميل ملف ZIP من downloadUrl إلى audio/temp/{id}.zip
     └── تحديث progress في StateMachine أثناء التحميل

  2. VALIDATE
     ├── تحديث StateMachine: DOWNLOADING → VALIDATING
     ├── فحص SHA-256 للـ ZIP مقارنةً بـ checksum في الكتالوج
     ├── إذا فشل: StateMachine → CORRUPTED، حذف ZIP، توقف
     └── إذا نجح: المتابعة

  3. EXTRACT
     ├── استخراج ZIP من temp/ إلى packages/{type}/{id}/
     └── التحقق من وجود audio/ و assets/ و manifest.json

  4. INSTALL
     ├── تحديث StateMachine: VALIDATING → INSTALLING
     ├── audioStorage.installLocalPackage() — كتابة manifest.json
     └── التحقق من اكتمال الهيكل

  5. REGISTRY UPDATE
     ├── registryService.addOrUpdatePackage()
     └── تحديث StateMachine: INSTALLING → INSTALLED

  6. CLEANUP
     ├── حذف ملف ZIP من temp/
     └── تحديث StateMachine بالحالة النهائية

  المخرج: AudioRepositoryResult<void>

  عند أي فشل في أي مرحلة:
  → StateMachine → FAILED
  → حذف الملفات الجزئية
  → تقرير مفصّل بسبب الفشل
```

---

## 12. القواعد الهندسية

هذه القواعد تمثّل عقداً غير مكتوب بين جميع مطوّري هذا النظام. كسر أي قاعدة يُخلّ بعزل الطبقات ويُصعّب الصيانة.

### قواعد الوصول

| القاعدة | السبب |
|---------|-------|
| **الـ UI لا يصل إلى Storage مباشرة** | منطق التنسيق ينتشر في الـ UI ويصعب تغييره |
| **الـ UI لا يصل إلى RegistryService مباشرة** | نفس السبب — Repository هو من يضمن الاتساق |
| **Repository هو نقطة الدخول الوحيدة للـ UI** | عقد واحد للواجهة يسهّل الصيانة والاختبار |

### قواعد الاعتماد بين الطبقات

| القاعدة | السبب |
|---------|-------|
| **Storage لا يعرف Registry** | Storage يكتب ملفات فقط — التنسيق مسؤولية Repository |
| **Catalog لا يعرف Repository** | Catalog يقرأ الكتالوج فقط — المقارنة مسؤولية Repository |
| **Validator مستقل بالكامل** | لا آثار جانبية — يُستخدم في أي مكان بأمان |
| **StateMachine مستقلة بالكامل** | حالات ذاكرة فقط — لا علاقة بالـ FileSystem |
| **CatalogSource قابل للاستبدال** | تغيير المصدر بدون لمس CatalogService |

### قواعد Schema

| القاعدة | السبب |
|---------|-------|
| **مصدر واحد للحقيقة: `AudioPackage` في `audio-manifest.ts`** | لا يُضاف تعريف ثانٍ لـ `AudioPackage` في أي ملف آخر |
| **مصدر واحد للحقيقة: `AudioType` في `audio-types.ts`** | نفس السبب |
| **عدم تعديل Schema دون تحديث `AUDIO_MANIFEST_SCHEMA_VERSION`** | يمنع قراءة ملفات قديمة بمخطط جديد |
| **`metadata` يستوعب الحقول الخاصة بكل نوع** | لا تُضاف حقول جديدة لـ `AudioPackage` لكل نوع صوتي |

---

## 13. Future Extension — إضافة أنواع صوتية جديدة

النظام مصمم بحيث **إضافة نوع صوتي جديد لا تتطلب أي تعديل معماري**. إليك كيف:

### الآلية

```typescript
// audio-types.ts — إضافة سطر واحد فقط
export type AudioType =
  | 'adhan'
  | 'quran'
  | 'ruqyah'
  | 'dua'
  | 'notification'
  | 'custom'
  | 'new-type';  // ← إضافة هنا فقط
```

### ما يتغيّر؟

| المكوّن | التغيير المطلوب |
|---------|---------------|
| `audio-types.ts` | إضافة القيمة الجديدة لـ `AudioType` |
| `index.json` (السيرفر) | إضافة التصنيف الجديد في `categories[]` + الحزم الجديدة في `packages[]` |
| `AudioStorageService` | **لا شيء** — المجلدات تُنشأ ديناميكياً بناءً على `type` |
| `RegistryService` | **لا شيء** — يخزّن `type` كـ string |
| `CatalogService` | **لا شيء** — يُرجع الحزم بأي type موجود في الكتالوج |
| `PackageValidator` | تحديث قائمة `AudioType` المقبولة فقط |
| `PackageStateMachine` | **لا شيء** — تتبع الحالة مستقل عن النوع |
| `AudioRepository` | **لا شيء** — يعمل مع أي نوع |

### أمثلة عملية

| النوع الجديد | ما يحتاجه فقط |
|-------------|------------|
| مؤذن جديد (adhan) | إضافة حزمة جديدة في `index.json` بـ `type: "adhan"` |
| قارئ قرآن جديد (quran) | إضافة حزمة بـ `type: "quran"` + `metadata: { suras: 114, riwaya: "..." }` |
| رقية جديدة (ruqyah) | إضافة حزمة بـ `type: "ruqyah"` + `metadata: { scholar: "..." }` |
| دعاء جديد (dua) | إضافة حزمة بـ `type: "dua"` |
| صوت إشعار جديد (notification) | إضافة حزمة بـ `type: "notification"` + `builtIn: true` |
| نوع مخصص جديد | إضافة القيمة لـ `AudioType` + التصنيف في الكتالوج |

### حقل `metadata` كمحرك التوسع

كل حزمة تحمل `metadata: Record<string, unknown>` لتخزين بيانات خاصة بنوعها:

```json
// adhan
"metadata": { "maqam": "رست", "recordingQuality": "studio" }

// quran
"metadata": { "riwaya": "حفص", "suras": 114, "narrator": "..." }

// ruqyah
"metadata": { "scholar": "ابن باز", "source": "السنة النبوية" }

// notification
"metadata": { "duration": 3, "category": "prayer-time" }
```

الـ UI يقرأ `metadata` لعرض تفاصيل إضافية لكل نوع — Schema الأساسي لا يتغيّر.

---

*آخر تحديث: المرحلة 18 — 2026-07-05*
