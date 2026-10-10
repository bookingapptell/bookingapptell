const API_BASE = 'https://script.google.com/macros/s/AKfycbzWLPgSboFo7wzKlgFN8az3nehWEVrwX_ud21BzAl1R8cJCQPAR26UAClhMplTAcECb/exec';

let token = localStorage.getItem('adminToken') || '';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

async function api(action, params = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  if (token) url.searchParams.set('token', token);
  Object.keys(params).forEach((k) => url.searchParams.set(k, params[k]));
  const res = await fetch(url.toString());
  return res.json();
}

const DOW_LABELS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const STATUS_FA = { paid: 'پرداخت‌شده', confirmed: 'تایید شده (حضوری)', pending: 'در انتظار پرداخت', cancelled: 'لغوشده', failed: 'ناموفق' };
let CATEGORIES = [];

// ----------------------------- ورود -----------------------------
// ----------------------------- ورود با پیامک (اصلی) -----------------------------
let otpPhone = '';

$('#otp-send-btn').addEventListener('click', async () => {
  const phone = $('#otp-phone').value.trim();
  if (!/^09\d{9}$/.test(phone)) { toast('شماره موبایل رو درست وارد کن'); return; }
  const btn = $('#otp-send-btn');
  btn.disabled = true;
  btn.textContent = 'در حال ارسال...';
  const res = await api('adminRequestOtp', { phone });
  btn.disabled = false;
  btn.textContent = 'ارسال کد تایید';
  if (!res.ok) { toast(res.error || 'ارسال کد ناموفق بود'); return; }
  otpPhone = phone;
  $('#otp-step-phone').classList.add('hidden');
  $('#otp-step-code').classList.remove('hidden');
  toast('کد تایید پیامک شد ✅');
});

$('#otp-verify-btn').addEventListener('click', async () => {
  const code = $('#otp-code').value.trim();
  if (!code) { toast('کد رو وارد کن'); return; }
  const btn = $('#otp-verify-btn');
  btn.disabled = true;
  btn.textContent = 'در حال بررسی...';
  const res = await api('adminVerifyOtp', { phone: otpPhone, code });
  btn.disabled = false;
  btn.textContent = 'ورود';
  if (!res.ok) { toast(res.error || 'کد اشتباهه'); return; }
  token = res.token;
  localStorage.setItem('adminToken', token);
  showPanel();
});

$('#otp-resend-btn').addEventListener('click', async () => {
  const res = await api('adminRequestOtp', { phone: otpPhone });
  toast(res.ok ? 'کد دوباره فرستاده شد' : (res.error || 'ارسال ناموفق بود'));
});

// ----------------------------- ورود با رمز عبور (روش قدیمی، پشتیبان) -----------------------------
$('#show-password-login').addEventListener('click', (e) => {
  e.preventDefault();
  $('#otp-step-phone').classList.add('hidden');
  $('#otp-step-code').classList.add('hidden');
  $('#password-login-box').classList.remove('hidden');
});

$('#login-btn').addEventListener('click', async () => {
  const password = $('#admin-password').value;
  const res = await api('adminLogin', { password });
  if (!res.ok) { toast(res.error || 'رمز اشتباه است'); return; }
  token = res.token;
  localStorage.setItem('adminToken', token);
  showPanel();
});

async function showPanel() {
  $('#login-box').classList.add('hidden');
  $('#panel').classList.remove('hidden');
  await loadCategories();
  loadBookings();
  loadServices();
  loadSettings();
  loadBranding();
}

// ----------------------------- تب‌ها -----------------------------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $('#tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'customers') loadCustomers();
  });
});

// ----------------------------- نوبت‌ها -----------------------------
async function loadBookings() {
  const wrap = $('#bookings-list');
  wrap.innerHTML = '<div class="empty-note">در حال بارگذاری...</div>';
  const res = await api('adminGetBookings');
  if (!res.ok) { wrap.innerHTML = '<div class="empty-note">خطا در دریافت</div>'; return; }
  wrap.innerHTML = '';
  if (res.bookings.length === 0) { wrap.innerHTML = '<div class="empty-note">هنوز نوبتی ثبت نشده</div>'; return; }
  res.bookings.forEach((b) => {
    const item = el('div', 'list-item');
    item.innerHTML = `
      <div class="row">
        <strong>${b.customerName}</strong>
        <span class="badge ${b.status}">${STATUS_FA[b.status] || b.status}</span>
      </div>
      <div style="font-size:13px; color:var(--muted); margin-top:4px;">
        ${b.serviceName} — ${b.displayDate || b.date} ساعت ${b.time}<br>${b.phone}
      </div>
      <div class="actions"></div>
    `;
    if (b.status !== 'cancelled') {
      const cancelBtn = el('button', 'small-btn danger', 'لغو نوبت');
      cancelBtn.addEventListener('click', async () => {
        if (!confirm('لغو این نوبت؟')) return;
        await api('adminCancelBooking', { id: b.id });
        loadBookings();
      });
      item.querySelector('.actions').appendChild(cancelBtn);
    }
    wrap.appendChild(item);
  });
}

// ----------------------------- دسته‌بندی‌ها -----------------------------
async function loadCategories() {
  const res = await api('getCategories');
  CATEGORIES = res.ok ? res.categories : [];
  renderCategoriesList_();
  renderCategorySelect_($('#new-service-category'));
}

function renderCategoriesList_() {
  const wrap = $('#categories-list');
  wrap.innerHTML = '';
  if (CATEGORIES.length === 0) {
    wrap.innerHTML = '<div class="empty-note">هنوز دسته‌بندی‌ای اضافه نکردی</div>';
    return;
  }
  CATEGORIES.forEach((cat) => {
    const item = el('div', 'list-item');
    item.innerHTML = `
      <div class="row">
        <strong>${cat.emoji} ${cat.label}</strong>
      </div>
      <div class="actions"></div>
    `;
    const delBtn = el('button', 'small-btn danger', 'حذف');
    delBtn.addEventListener('click', async () => {
      if (!confirm(`دسته‌بندی «${cat.label}» حذف بشه؟ خدماتی که این دسته رو داشتن، بدون دسته‌بندی می‌مونن.`)) return;
      await api('adminDeleteCategory', { key: cat.key });
      toast('دسته‌بندی حذف شد');
      loadCategories();
      loadServices();
    });
    item.querySelector('.actions').appendChild(delBtn);
    wrap.appendChild(item);
  });
}

// یه <select> رو با آپشن‌های دسته‌بندی فعلی پر می‌کنه — برای فرم افزودن و هر ردیف ویرایش استفاده میشه
function renderCategorySelect_(selectEl, selectedKey) {
  if (!selectEl) return;
  selectEl.innerHTML = CATEGORIES.map((c) =>
    `<option value="${c.key}" ${c.key === selectedKey ? 'selected' : ''}>${c.emoji} ${c.label}</option>`
  ).join('');
}

$('#add-category-btn').addEventListener('click', async () => {
  const label = $('#new-category-label').value.trim();
  const emoji = $('#new-category-emoji').value.trim();
  if (!label || !emoji) { toast('اسم و آیکون رو پر کن'); return; }
  await api('adminAddCategory', { label, emoji });
  $('#new-category-label').value = '';
  $('#new-category-emoji').value = '';
  toast('دسته‌بندی اضافه شد ✅');
  loadCategories();
});

// ----------------------------- خدمات -----------------------------
async function loadServices() {
  const wrap = $('#services-list');
  wrap.innerHTML = '<div class="empty-note">در حال بارگذاری...</div>';
  const res = await api('adminServices');
  if (!res.ok) { wrap.innerHTML = '<div class="empty-note">خطا در دریافت</div>'; return; }
  wrap.innerHTML = '';
  res.services.forEach((s) => {
    const active = String(s.active).toUpperCase() === 'TRUE';
    const payInPerson = String(s.payInPerson).toUpperCase() === 'TRUE';
    const catInfo = CATEGORIES.find((c) => c.key === s.category);
    const item = el('div', 'list-item');
    item.innerHTML = `
      <div class="row">
        <strong>${s.name}</strong>
        <span>${Number(s.price).toLocaleString('fa-IR')} تومان</span>
      </div>
      <div style="font-size:13px; color:var(--muted); margin-top:4px;">
        ${s.duration} دقیقه${payInPerson ? ' · <span style="color:var(--blush-deep);">پرداخت حضوری</span>' : ''}
        ${catInfo ? ` · ${catInfo.emoji} ${catInfo.label}` : ' · <span style="color:var(--danger);">بدون دسته‌بندی</span>'}
        ${s.staffName ? ' · ' + s.staffName : ''}
      </div>
      <div class="actions"></div>
      <div class="edit-form hidden" style="margin-top:12px; padding-top:12px; border-top:1px solid var(--line);">
        <div class="field"><label>نام خدمت</label><input class="edit-name" value="${s.name}"></div>
        <div class="field"><label>قیمت (تومان)</label><input class="edit-price" type="number" value="${s.price}"></div>
        <div class="field"><label>مدت زمان (دقیقه)</label><input class="edit-duration" type="number" value="${s.duration}"></div>
        <div class="field">
          <label>دسته‌بندی</label>
          <select class="edit-category" style="width:100%; border:2px solid var(--line); border-radius:12px; padding:12px; font-family:'Vazirmatn'; background:var(--paper);">
            ${CATEGORIES.map((c) => `<option value="${c.key}" ${s.category === c.key ? 'selected' : ''}>${c.emoji} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>اسم شخص انجام‌دهنده (اختیاری)</label><input class="edit-staffname" value="${s.staffName || ''}" placeholder="مثلاً سارا"></div>
        <div class="field">
          <label>لینک لوکیشن محل کار (اختیاری)</label>
          <input class="edit-location" value="${s.locationUrl || ''}" placeholder="یا از دکمه‌های پایین کمک بگیر" dir="ltr" style="text-align:left;">
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
            <button type="button" class="btn btn-ghost edit-location-gps-btn" style="font-size:12.5px; padding:8px 14px;">📍 استفاده از موقعیت فعلی من</button>
            <button type="button" class="btn btn-ghost edit-location-maps-web-btn" style="font-size:12.5px; padding:8px 14px;">🗺️ باز کردن گوگل‌مپ وب</button>
          </div>
          <p style="font-size:11px; color:var(--muted); margin-top:8px; line-height:1.9;">
            روش ۱ (ساده‌تر): وقتی توی همون محل هستی، «موقعیت فعلی من» رو بزن.<br>
            روش ۲ (برای جای دیگه): «باز کردن گوگل‌مپ وب» رو بزن → لوکیشن رو سرچ کن یا رو نقشه پیدا کن → <b>آدرس بالای مرورگر</b> (نوار آدرس، نه دکمه‌ی Share) رو کپی کن → برگرد اینجا و توی همین فیلد بالا پیست کن.<br>
            نکته: اگه با زدن دکمه، به‌جای مرورگر، خودِ اپ گوگل‌مپ باز شد (رفتار خودِ گوشیه)، از همون‌جا هم میشه: لوکیشن رو نگه‌دار بزن تا سنجاق بیفته، پایین صفحه روی مختصات (اعداد لوکیشن) بزن تا کپی بشه.
          </p>
        </div>
        <div class="field">
          <label>عکس شخص انجام‌دهنده (اختیاری)</label>
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <img class="edit-staffimg-preview ${s.staffImageUrl ? '' : 'hidden'}" src="${s.staffImageUrl || ''}" style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid var(--line);">
            <label class="btn btn-ghost" style="cursor:pointer; font-size:13px; padding:10px 16px;">انتخاب عکس از گوشی<input type="file" accept="image/*" class="hidden edit-staffimg-file"></label>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-ghost edit-staffimg-gallery-btn" style="font-size:12.5px; padding:8px 14px;">انتخاب از عکس‌های قبلی</button>
            <button type="button" class="btn btn-ghost edit-staffimg-remove-btn" style="font-size:12.5px; padding:8px 14px; color:var(--danger);">حذف عکس</button>
          </div>
          <div class="edit-staffimg-gallery hidden" style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:10px;"></div>
          <div class="edit-staffimg-status" style="font-size:12px; color:var(--muted); margin-top:8px;"></div>
        </div>
        <label style="display:flex; align-items:center; gap:6px; font-size:13.5px; margin-bottom:14px;">
          <input type="checkbox" class="edit-payinperson" ${payInPerson ? 'checked' : ''}> پرداخت حضوری (نیازی به درگاه پرداخت نیست)
        </label>
        <div class="field">
          <label>عکس پس‌زمینه‌ی کارت</label>
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <img class="edit-image-preview ${s.imageUrl ? '' : 'hidden'}" src="${s.imageUrl || ''}" style="width:56px; height:56px; border-radius:12px; object-fit:cover; border:2px solid var(--line);">
            <label class="btn btn-ghost" style="cursor:pointer; font-size:13px; padding:10px 16px;">انتخاب عکس از گوشی<input type="file" accept="image/*" class="hidden edit-image-file"></label>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-ghost edit-image-gallery-btn" style="font-size:12.5px; padding:8px 14px;">انتخاب از عکس‌های قبلی</button>
            <button type="button" class="btn btn-ghost edit-image-remove-btn" style="font-size:12.5px; padding:8px 14px; color:var(--danger);">حذف عکس</button>
          </div>
          <div class="edit-image-gallery hidden" style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:10px;"></div>
          <div class="edit-image-status" style="font-size:12px; color:var(--muted); margin-top:8px;"></div>
          <div class="field" style="margin-top:10px;">
            <label>موقعیت نمایش عکس توی کادر</label>
            <select class="edit-image-position" style="width:100%; border:2px solid var(--line); border-radius:12px; padding:12px; font-family:'Vazirmatn'; background:var(--paper);">
              <option value="top" ${s.imagePosition === 'top' ? 'selected' : ''}>بالا</option>
              <option value="center" ${(!s.imagePosition || s.imagePosition === 'center') ? 'selected' : ''}>وسط</option>
              <option value="bottom" ${s.imagePosition === 'bottom' ? 'selected' : ''}>پایین</option>
            </select>
          </div>
        </div>
        <button class="btn btn-block save-edit-btn">ذخیره تغییرات</button>
      </div>
    `;

    let currentImageUrl = s.imageUrl || '';
    let currentStaffImageUrl = s.staffImageUrl || '';

    const editBtn = el('button', 'small-btn', 'ویرایش قیمت / نام');
    const toggleBtn = el('button', 'small-btn', active ? 'غیرفعال کردن' : 'فعال کردن');
    const editForm = item.querySelector('.edit-form');

    editBtn.addEventListener('click', () => {
      editForm.classList.toggle('hidden');
    });

    toggleBtn.addEventListener('click', async () => {
      await api('adminEditService', { id: s.id, name: s.name, price: s.price, duration: s.duration, active: active ? 'false' : 'true', payInPerson: payInPerson ? 'true' : 'false', imageUrl: currentImageUrl, imagePosition: s.imagePosition || 'center', category: s.category || '', staffName: s.staffName || '', staffImageUrl: currentStaffImageUrl, locationUrl: s.locationUrl || '' });
      loadServices();
    });

    item.querySelector('.edit-location-gps-btn').addEventListener('click', () => {
      useCurrentLocation_(item.querySelector('.edit-location'));
    });

    item.querySelector('.edit-location-maps-web-btn').addEventListener('click', () => {
      window.open('https://maps.google.com', '_blank', 'noopener');
    });

    const staffImgPreview = item.querySelector('.edit-staffimg-preview');
    const staffImgStatus = item.querySelector('.edit-staffimg-status');

    item.querySelector('.edit-staffimg-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await resizeImageToDataUrl_(file, 400, 0.85);
      staffImgPreview.src = dataUrl;
      staffImgPreview.classList.remove('hidden');
      staffImgStatus.textContent = 'در حال آپلود...';
      try {
        const base64 = dataUrl.split(',')[1];
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'adminUploadImage', token, target: 'staffImage', fileName: file.name, mimeType: 'image/jpeg', data: base64 }),
        });
        const result = await res.json();
        if (result.ok) {
          currentStaffImageUrl = result.url;
          staffImgStatus.textContent = 'آپلود شد — «ذخیره تغییرات» رو بزن';
        } else {
          staffImgStatus.textContent = 'خطا: ' + (result.error || 'آپلود ناموفق بود');
        }
      } catch (err) {
        staffImgStatus.textContent = 'خطا در آپلود عکس';
      }
    });

    item.querySelector('.edit-staffimg-remove-btn').addEventListener('click', () => {
      currentStaffImageUrl = '';
      staffImgPreview.classList.add('hidden');
      staffImgStatus.textContent = 'عکس حذف شد — «ذخیره تغییرات» رو بزن';
    });

    setupGalleryButtonEl_(item.querySelector('.edit-staffimg-gallery-btn'), item.querySelector('.edit-staffimg-gallery'), (url) => {
      currentStaffImageUrl = url;
      staffImgPreview.src = url;
      staffImgPreview.classList.remove('hidden');
      staffImgStatus.textContent = 'انتخاب شد — «ذخیره تغییرات» رو بزن';
    });

    const imagePreview = item.querySelector('.edit-image-preview');
    const imageStatus = item.querySelector('.edit-image-status');

    item.querySelector('.edit-image-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await resizeImageToDataUrl_(file, 500, 0.85);
      imagePreview.src = dataUrl;
      imagePreview.classList.remove('hidden');
      imageStatus.textContent = 'در حال آپلود...';
      try {
        const base64 = dataUrl.split(',')[1];
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'adminUploadImage', token, target: 'serviceImage', fileName: file.name, mimeType: 'image/jpeg', data: base64 }),
        });
        const result = await res.json();
        if (result.ok) {
          currentImageUrl = result.url;
          imageStatus.textContent = 'آپلود شد — «ذخیره تغییرات» رو بزن';
        } else {
          imageStatus.textContent = 'خطا: ' + (result.error || 'آپلود ناموفق بود');
        }
      } catch (err) {
        imageStatus.textContent = 'خطا در آپلود عکس';
      }
    });

    item.querySelector('.edit-image-remove-btn').addEventListener('click', () => {
      currentImageUrl = '';
      imagePreview.classList.add('hidden');
      imageStatus.textContent = 'عکس حذف شد — «ذخیره تغییرات» رو بزن';
    });

    setupGalleryButtonEl_(item.querySelector('.edit-image-gallery-btn'), item.querySelector('.edit-image-gallery'), (url) => {
      currentImageUrl = url;
      imagePreview.src = url;
      imagePreview.classList.remove('hidden');
      imageStatus.textContent = 'انتخاب شد — «ذخیره تغییرات» رو بزن';
    });

    item.querySelector('.save-edit-btn').addEventListener('click', async () => {
      const name = item.querySelector('.edit-name').value.trim();
      const price = item.querySelector('.edit-price').value;
      const duration = item.querySelector('.edit-duration').value;
      const category = item.querySelector('.edit-category').value;
      const staffName = item.querySelector('.edit-staffname').value.trim();
      const locationUrl = normalizeUrl_(item.querySelector('.edit-location').value.trim());
      const payInPersonChecked = item.querySelector('.edit-payinperson').checked;
      const imagePosition = item.querySelector('.edit-image-position').value;
      if (!name || !price || !duration) { toast('همه فیلدها را پر کن'); return; }
      const btn = item.querySelector('.save-edit-btn');
      btn.disabled = true;
      btn.textContent = 'در حال ذخیره...';
      await api('adminEditService', { id: s.id, name, price, duration, active: active ? 'true' : 'false', payInPerson: payInPersonChecked ? 'true' : 'false', imageUrl: currentImageUrl, imagePosition, category, staffName, staffImageUrl: currentStaffImageUrl, locationUrl });
      toast('قیمت و مشخصات خدمت به‌روزرسانی شد ✅');
      loadServices();
    });

    item.querySelector('.actions').appendChild(editBtn);
    item.querySelector('.actions').appendChild(toggleBtn);
    wrap.appendChild(item);
  });
}

// دکمه‌ی گالری با المنت مستقیم (نه آی‌دی) کار می‌کنه تا برای چندتا خدمت هم‌زمان قابل استفاده باشه
function setupGalleryButtonEl_(btn, gallery, onPick) {
  btn.addEventListener('click', async () => {
    const isHidden = gallery.classList.contains('hidden');
    if (!isHidden) { gallery.classList.add('hidden'); return; }

    gallery.classList.remove('hidden');
    gallery.innerHTML = '<div class="empty-note" style="grid-column: 1 / -1;">در حال بارگذاری...</div>';
    const images = await fetchImages_();
    if (images.length === 0) {
      gallery.innerHTML = '<div class="empty-note" style="grid-column: 1 / -1;">هنوز عکسی آپلود نکردی</div>';
      return;
    }
    gallery.innerHTML = '';
    images.forEach((img) => {
      const thumb = el('img');
      thumb.src = img.url;
      thumb.style.cssText = 'width:100%; aspect-ratio:1; object-fit:cover; border-radius:10px; border:2px solid var(--line); cursor:pointer;';
      thumb.addEventListener('click', () => {
        onPick(img.url);
        gallery.classList.add('hidden');
      });
      gallery.appendChild(thumb);
    });
  });
}

$('#add-service-btn').addEventListener('click', async () => {
  const name = $('#new-service-name').value.trim();
  const price = $('#new-service-price').value;
  const duration = $('#new-service-duration').value;
  const category = $('#new-service-category').value;
  const staffName = $('#new-service-staffname').value.trim();
  const staffImageUrl = $('#new-service-staffimg-url').value.trim();
  const locationUrl = normalizeUrl_($('#new-service-location').value.trim());
  const payInPerson = $('#new-service-payinperson').checked;
  const imageUrl = $('#new-service-image-url').value.trim();
  const imagePosition = $('#new-service-image-position').value;
  if (!name || !price || !duration) { toast('همه فیلدها را پر کن'); return; }
  await api('adminAddService', { name, price, duration, category, staffName, staffImageUrl, locationUrl, payInPerson: payInPerson ? 'true' : 'false', imageUrl, imagePosition });
  $('#new-service-name').value = '';
  $('#new-service-price').value = '';
  $('#new-service-duration').value = '';
  $('#new-service-category').value = 'lash';
  $('#new-service-staffname').value = '';
  $('#new-service-staffimg-url').value = '';
  $('#new-service-staffimg-preview').classList.add('hidden');
  $('#new-service-staffimg-status').textContent = '';
  $('#new-service-location').value = '';
  $('#new-service-payinperson').checked = false;
  $('#new-service-image-url').value = '';
  $('#new-service-image-preview').classList.add('hidden');
  $('#new-service-image-status').textContent = '';
  $('#new-service-image-position').value = 'center';
  toast('خدمت اضافه شد');
  loadServices();
});

$('#new-service-image-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) uploadBrandImage_(file, 'serviceImage', 500, '#new-service-image-url', '#new-service-image-preview', '#new-service-image-status');
});

$('#new-service-staffimg-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) uploadBrandImage_(file, 'staffImage', 400, '#new-service-staffimg-url', '#new-service-staffimg-preview', '#new-service-staffimg-status');
});

setupGalleryButton_('#new-service-gallery-btn', '#new-service-image-gallery', (url) => {
  $('#new-service-image-url').value = url;
  const preview = $('#new-service-image-preview');
  preview.src = url;
  preview.classList.remove('hidden');
  $('#new-service-image-status').textContent = 'انتخاب شد';
});

setupGalleryButton_('#new-service-staffimg-gallery-btn', '#new-service-staffimg-gallery', (url) => {
  $('#new-service-staffimg-url').value = url;
  const preview = $('#new-service-staffimg-preview');
  preview.src = url;
  preview.classList.remove('hidden');
  $('#new-service-staffimg-status').textContent = 'انتخاب شد';
});

// ----------------------------- بازه‌ی ساعت‌ها -----------------------------
async function loadSettings() {
  const res = await api('adminGetSettings');
  if (!res.ok) return;
  const s = res.settings;
  adminCalendarType = s.calendarType || 'jalali';
  $('#start-time').value = s.startTime || '10:00';
  $('#end-time').value = s.endTime || '19:00';
  $('#slot-interval').value = s.slotInterval || 60;
  buildAdminDateScroller();
}

$('#save-range-btn').addEventListener('click', async () => {
  await api('adminSaveSettings', {
    startTime: $('#start-time').value,
    endTime: $('#end-time').value,
    slotInterval: $('#slot-interval').value,
  });
  toast('بازه‌ی ساعت‌ها ذخیره شد');
  if (adminSelectedDate) loadDaySlots(adminSelectedDate); // چیدمان گزینه‌ها رو به‌روز کن
});

// ----------------------------- تقویم روزها و ساعات قابل رزرو -----------------------------
const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
let adminSelectedDate = null;
let adminOpenTimes = new Set();
let adminCalendarType = 'jalali';

// تبدیل تاریخ میلادی به شمسی (روی چند تاریخ مرجع شناخته‌شده تست و تایید شده)
function toJalali_(gy, gm, gd) {
  var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var gy2 = (gm > 2) ? (gy + 1) : gy;
  var days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  var jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  var jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
function toPersianDigits_(n) {
  return String(n).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d]);
}

function toLocalDateStr_(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function adminDayNumberFor_(d) {
  if (adminCalendarType === 'gregorian') return toPersianDigits_(d.getDate());
  const j = toJalali_(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return toPersianDigits_(j.jd);
}

function buildAdminDateScroller() {
  const wrap = $('#admin-date-scroller');
  wrap.innerHTML = '';
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = toLocalDateStr_(d);
    const chip = el('div', 'date-chip');
    chip.innerHTML = `<div class="dow">${PERSIAN_WEEKDAYS[d.getDay()]}</div><div class="dom">${adminDayNumberFor_(d)}</div>`;
    chip.addEventListener('click', () => {
      document.querySelectorAll('#admin-date-scroller .date-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      loadDaySlots(iso);
    });
    wrap.appendChild(chip);
  }
}

async function loadDaySlots(dateIso) {
  adminSelectedDate = dateIso;
  const grid = $('#admin-slot-grid');
  grid.innerHTML = '<div class="empty-note">در حال بارگذاری...</div>';
  const res = await api('adminGetDaySlots', { date: dateIso });
  if (!res.ok) { grid.innerHTML = '<div class="empty-note">خطا در دریافت</div>'; return; }

  adminOpenTimes = new Set(res.open);
  grid.innerHTML = '';
  if (res.candidates.length === 0) {
    grid.innerHTML = '<div class="empty-note">اول بازه‌ی ساعت رو بالا تنظیم و ذخیره کن</div>';
  } else {
    res.candidates.forEach((t) => {
      const slot = el('div', 'slot', t);
      if (adminOpenTimes.has(t)) slot.classList.add('selected');
      slot.addEventListener('click', () => {
        if (adminOpenTimes.has(t)) { adminOpenTimes.delete(t); slot.classList.remove('selected'); }
        else { adminOpenTimes.add(t); slot.classList.add('selected'); }
      });
      grid.appendChild(slot);
    });
  }

  const saveBtn = $('#save-day-btn');
  saveBtn.disabled = false;
  saveBtn.textContent = 'ذخیره این روز';
}

$('#save-day-btn').addEventListener('click', async () => {
  if (!adminSelectedDate) return;
  const btn = $('#save-day-btn');
  btn.disabled = true;
  btn.textContent = 'در حال ذخیره...';
  await api('adminSetDaySlots', { date: adminSelectedDate, times: Array.from(adminOpenTimes).join(',') });
  toast('ساعت‌های این روز ذخیره شد ✅');
  btn.disabled = false;
  btn.textContent = 'ذخیره این روز';
});

// ----------------------------- برندینگ -----------------------------
async function loadBranding() {
  const res = await api('adminGetSettings');
  if (!res.ok) return;
  const s = res.settings;
  $('#calendar-type-input').value = s.calendarType || 'jalali';
  adminCalendarType = s.calendarType || 'jalali';
  $('#brand-name-input').value = s.brandName || 'استودیو زیبایی';
  $('#hero-title-input').value = s.heroTitle || 'نوبتت رو با یه دست بگیر ✨';
  $('#hero-subtitle-input').value = s.heroSubtitle || 'خدمت رو انتخاب کن، ساعت خالی رو ببین، پرداخت کن — تمام.';
  $('#brand-color-input').value = s.brandColor || '#D98A96';
  $('#brand-instagram-input').value = s.instagramUrl || '';
  $('#brand-phone-input').value = s.phoneNumber || '';
  $('#brand-telegram-bot-input').value = s.telegramBotUsername || '';
  $('#brand-address-input').value = s.address || '';
  $('#brand-map-input').value = s.mapUrl || '';
  $('#brand-cancelhours-input').value = s.cancelHours || '';
  $('#brand-loyalty-every-input').value = s.loyaltyEvery || '';
  $('#brand-loyalty-percent-input').value = s.loyaltyPercent || '';
  $('#brand-bday-percent-input').value = s.birthdayPercent || '';
  $('#brand-bday-days-input').value = s.birthdayDays || '';

  $('#brand-logo-input').value = s.logoUrl || '';
  if (s.logoUrl) {
    const preview = $('#brand-logo-preview');
    preview.src = s.logoUrl;
    preview.classList.remove('hidden');
  }

  $('#brand-hero-input').value = s.heroImageUrl || '';
  if (s.heroImageUrl) {
    const preview = $('#brand-hero-preview');
    preview.src = s.heroImageUrl;
    preview.classList.remove('hidden');
  }

  $('#brand-bg-input').value = s.backgroundUrl || '';
  if (s.backgroundUrl) {
    const preview = $('#brand-bg-preview');
    preview.src = s.backgroundUrl;
    preview.classList.remove('hidden');
  }

}

$('#save-brand-btn').addEventListener('click', async () => {
  const btn = $('#save-brand-btn');
  btn.disabled = true;
  btn.textContent = 'در حال ذخیره...';
  await api('adminSaveSettings', {
    brandName: $('#brand-name-input').value.trim() || 'استودیو زیبایی',
    heroTitle: $('#hero-title-input').value.trim() || 'نوبتت رو با یه دست بگیر ✨',
    heroSubtitle: $('#hero-subtitle-input').value.trim() || 'خدمت رو انتخاب کن، ساعت خالی رو ببین، پرداخت کن — تمام.',
    brandColor: $('#brand-color-input').value,
    instagramUrl: $('#brand-instagram-input').value.trim(),
    phoneNumber: $('#brand-phone-input').value.trim(),
    telegramBotUsername: $('#brand-telegram-bot-input').value.trim().replace(/^@/, ''),
    address: $('#brand-address-input').value.trim(),
    mapUrl: $('#brand-map-input').value.trim(),
    cancelHours: $('#brand-cancelhours-input').value.trim(),
    loyaltyEvery: $('#brand-loyalty-every-input').value.trim(),
    loyaltyPercent: $('#brand-loyalty-percent-input').value.trim(),
    birthdayPercent: $('#brand-bday-percent-input').value.trim(),
    birthdayDays: $('#brand-bday-days-input').value.trim(),
    logoUrl: $('#brand-logo-input').value.trim(),
    heroImageUrl: $('#brand-hero-input').value.trim(),
    calendarType: $('#calendar-type-input').value,
    backgroundUrl: $('#brand-bg-input').value.trim(),
  });
  adminCalendarType = $('#calendar-type-input').value;
  if ($('#admin-date-scroller').children.length > 0) buildAdminDateScroller();
  toast('برندینگ ذخیره شد ✅ توی صفحه‌ی رزرو مشتری هم اعمال میشه');
  btn.disabled = false;
  btn.textContent = 'ذخیره برندینگ';
});

// عکس رو روی گوشی کوچیک و فشرده می‌کنه قبل از آپلود، تا سریع و سبک بمونه
function resizeImageToDataUrl_(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('فایل عکس معتبر نیست'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; }
        else if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// آپلود عکس جدید — target: 'logoUrl' یا 'backgroundUrl'، maxSize: حداکثر عرض/ارتفاع بعد از فشرده‌سازی
async function uploadBrandImage_(file, target, maxSize, inputSel, previewSel, statusSel) {
  const status = $(statusSel);
  const preview = $(previewSel);
  try {
    status.textContent = 'در حال آماده‌سازی عکس...';
    const dataUrl = await resizeImageToDataUrl_(file, maxSize, 0.85);
    preview.src = dataUrl;
    preview.classList.remove('hidden');

    status.textContent = 'در حال آپلود...';
    const base64 = dataUrl.split(',')[1];

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'adminUploadImage', token, target, fileName: file.name, mimeType: 'image/jpeg', data: base64 }),
    });
    const result = await res.json();

    if (result.ok) {
      $(inputSel).value = result.url;
      status.textContent = 'آپلود شد و ذخیره شد ✅';
    } else {
      status.textContent = 'خطا: ' + (result.error || 'آپلود ناموفق بود');
    }
  } catch (err) {
    status.textContent = 'خطا در آپلود عکس';
  }
}

$('#brand-logo-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadBrandImage_(file, 'logoUrl', 500, '#brand-logo-input', '#brand-logo-preview', '#brand-logo-status');
});

$('#brand-hero-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadBrandImage_(file, 'heroImageUrl', 1000, '#brand-hero-input', '#brand-hero-preview', '#brand-hero-status');
});

$('#brand-hero-remove-btn').addEventListener('click', async () => {
  $('#brand-hero-input').value = '';
  $('#brand-hero-preview').classList.add('hidden');
  await api('adminSaveSettings', { heroImageUrl: '' });
  toast('عکس کادر بالایی حذف شد');
});

$('#brand-bg-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadBrandImage_(file, 'backgroundUrl', 1200, '#brand-bg-input', '#brand-bg-preview', '#brand-bg-status');
});

$('#brand-bg-remove-btn').addEventListener('click', async () => {
  $('#brand-bg-input').value = '';
  $('#brand-bg-preview').classList.add('hidden');
  await api('adminSaveSettings', { backgroundUrl: '' });
  toast('پس‌زمینه حذف شد');
});

// ----------------------------- گالری عکس‌های قبلی -----------------------------
let imagesCache = null;

async function fetchImages_() {
  if (imagesCache) return imagesCache;
  const res = await api('adminListImages');
  imagesCache = res.ok ? res.images : [];
  return imagesCache;
}

function setupGalleryButton_(btnSel, gallerySel, onPick) {
  setupGalleryButtonEl_($(btnSel), $(gallerySel), onPick);
}

setupGalleryButton_('#brand-logo-gallery-btn', '#brand-logo-gallery', (url) => {
  $('#brand-logo-input').value = url;
  const preview = $('#brand-logo-preview');
  preview.src = url;
  preview.classList.remove('hidden');
  $('#brand-logo-status').textContent = 'انتخاب شد — پایین «ذخیره برندینگ» رو بزن';
});

setupGalleryButton_('#brand-hero-gallery-btn', '#brand-hero-gallery', (url) => {
  $('#brand-hero-input').value = url;
  const preview = $('#brand-hero-preview');
  preview.src = url;
  preview.classList.remove('hidden');
  $('#brand-hero-status').textContent = 'انتخاب شد — پایین «ذخیره برندینگ» رو بزن';
});

setupGalleryButton_('#brand-bg-gallery-btn', '#brand-bg-gallery', (url) => {
  $('#brand-bg-input').value = url;
  const preview = $('#brand-bg-preview');
  preview.src = url;
  preview.classList.remove('hidden');
  $('#brand-bg-status').textContent = 'انتخاب شد — پایین «ذخیره برندینگ» رو بزن';
});

// ----------------------------- آیکون وب‌اپ -----------------------------
// عکس رو مربعی (از وسط) می‌بره و توی سایز مشخص روی کانواس می‌کشه، بعد به‌صورت PNG قابل‌دانلود درمیاره
function squareCanvasToPngUrl_(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const srcSize = Math.min(img.width, img.height);
  const sx = (img.width - srcSize) / 2;
  const sy = (img.height - srcSize) / 2;
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

// نسخه‌ی «maskable»: عکس رو کوچیک‌تر و وسط‌چین می‌کشه با یه حاشیه‌ی پررنگ دورش،
// چون گوشی‌های اندروید ممکنه لبه‌های آیکون رو (به‌شکل دایره یا هر شکل دیگه) ببرن —
// این حاشیه باعث میشه چیزی از لوگوی اصلی بریده نشه
function maskableCanvasToPngUrl_(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2A1B2E';
  ctx.fillRect(0, 0, size, size);
  const scale = 0.68; // ناحیه‌ی امن استاندارد maskable
  const innerSize = size * scale;
  const offset = (size - innerSize) / 2;
  const srcSize = Math.min(img.width, img.height);
  const sx = (img.width - srcSize) / 2;
  const sy = (img.height - srcSize) / 2;
  ctx.drawImage(img, sx, sy, srcSize, srcSize, offset, offset, innerSize, innerSize);
  return canvas.toDataURL('image/png');
}

$('#app-icon-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const preview = $('#app-icon-preview');
      preview.src = ev.target.result;
      preview.classList.remove('hidden');

      const url192 = squareCanvasToPngUrl_(img, 192);
      const url512 = squareCanvasToPngUrl_(img, 512);
      $('#app-icon-download-192').href = url192;
      $('#app-icon-download-512').href = url512;

      const urlMask192 = maskableCanvasToPngUrl_(img, 192);
      const urlMask512 = maskableCanvasToPngUrl_(img, 512);
      $('#app-icon-download-192-maskable').href = urlMask192;
      $('#app-icon-download-512-maskable').href = urlMask512;

      $('#app-icon-downloads').classList.remove('hidden');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// ----------------------------- لوکیشن (بر اساس GPS خود گوشی) -----------------------------
// اگه لینک با http شروع نشه، مرورگر بجای گوگل‌مپ می‌ره سراغ خود سایت (باعث خطای ۴۰۴ میشه)
function normalizeUrl_(u) {
  if (!u) return u;
  return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}

// موقعیت فعلی گوشی رو می‌گیره و به‌صورت لینک گوگل‌مپ توی همون فیلد می‌ذاره —
// نیازی به لود شدن نقشه از سرور خارجی نداره، برای همین همیشه کار می‌کنه
function useCurrentLocation_(targetInput) {
  if (!navigator.geolocation) {
    toast('مرورگرت از موقعیت مکانی پشتیبانی نمی‌کنه');
    return;
  }
  toast('در حال گرفتن موقعیت... چند لحظه صبر کن');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      targetInput.value = `https://www.google.com/maps?q=${lat},${lng}`;
      toast('لوکیشن فعلی ثبت شد ✅ — یادت نره پایین ذخیره کنی');
    },
    () => {
      toast('نتونستیم موقعیتت رو بگیریم — مطمئن شو GPS گوشیت روشنه و اجازه دسترسی دادی');
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

document.querySelectorAll('.location-gps-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    useCurrentLocation_($('#' + btn.dataset.target));
  });
});

document.querySelectorAll('.location-maps-web-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    window.open('https://maps.google.com', '_blank', 'noopener');
  });
});

// ----------------------------- اطلاع‌رسانی گروهی -----------------------------
$('#broadcast-telegram-btn').addEventListener('click', async () => {
  const text = $('#broadcast-text').value.trim();
  if (!text) { toast('یه متن بنویس'); return; }
  const btn = $('#broadcast-telegram-btn');
  btn.disabled = true;
  btn.textContent = 'در حال ارسال...';
  const res = await api('adminBroadcastTelegram', { text });
  btn.disabled = false;
  btn.textContent = 'ارسال به تلگرام همه';
  $('#broadcast-status').textContent = res.ok ? `به ${res.sent} نفر توی تلگرام فرستاده شد ✅` : (res.error || 'خطا در ارسال');
});


// ----------------------------- مشتری‌ها -----------------------------
const JALALI_MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const GREG_MONTHS_FA = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
let CUSTOMERS = [];

function escHtml(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadCustomers() {
  const wrap = $('#cust-list');
  wrap.innerHTML = '<div class="empty-note">در حال بارگذاری...</div>';
  let res;
  try {
    res = await api('adminGetCustomers');
  } catch (e) {
    wrap.innerHTML = '<div class="empty-note">ارتباط با سرور برقرار نشد. اینترنت رو چک کن و دوباره امتحان کن.</div>';
    return;
  }
  if (!res.ok) {
    const msg = res.error === 'دستور نامعتبر'
      ? 'سرور هنوز نسخه‌ی جدید رو نداره؛ Code.gs رو جایگزین و «New version» دیپلوی کن.'
      : (res.error || 'پاسخ نامعتبر');
    wrap.innerHTML = '<div class="empty-note">خطا در دریافت: ' + escHtml(msg) + '</div>';
    return;
  }
  CUSTOMERS = res.customers;
  renderCustomers();
}

function daysSince_(iso) {
  if (!iso) return null;
  const p = iso.split('-').map(Number);
  return Math.floor((Date.now() - new Date(p[0], p[1] - 1, p[2]).getTime()) / 86400000);
}

function filteredCustomers_() {
  const q = $('#cust-search').value.trim();
  const f = $('#cust-filter').value;
  return CUSTOMERS.filter((c) => {
    if (q && c.name.indexOf(q) === -1 && c.phone.indexOf(q) === -1) return false;
    if (f === 'bday') return c.daysToBirthday !== null && c.daysToBirthday <= 7;
    if (f === 'inactive') { const d = daysSince_(c.lastDate); return d !== null && d > 60; }
    if (f === 'never') return c.count === 0;
    if (f === 'vip') return c.tag === 'VIP';
    return true;
  });
}

function renderCustomers() {
  const list = filteredCustomers_();
  const wrap = $('#cust-list');
  $('#cust-count').textContent = list.length + ' نفر از ' + CUSTOMERS.length;
  wrap.innerHTML = '';
  if (list.length === 0) { wrap.innerHTML = '<div class="empty-note">مشتری‌ای پیدا نشد</div>'; return; }
  list.slice(0, 100).forEach((c) => {
    const item = el('div', 'list-item');
    const bd = c.birthdayDisplay ? ` — 🎂 ${escHtml(c.birthdayDisplay)}` : '';
    const last = c.lastDate ? `آخرین نوبت: ${escHtml(c.lastDate)}` : 'هنوز نوبتی نگرفته';
    item.innerHTML = `
      <div class="row">
        <strong>${escHtml(c.name || 'بدون نام')}${c.tag ? ' · ' + escHtml(c.tag) : ''}</strong>
        <span dir="ltr" style="font-size:12.5px; color:var(--muted);">${escHtml(c.phone)}</span>
      </div>
      <div style="font-size:12.5px; color:var(--muted); margin-top:4px;">
        ${c.count} نوبت · ${Number(c.total).toLocaleString('fa-IR')} تومان${bd}<br>${last}
      </div>
      <div class="cust-edit hidden" style="margin-top:12px;"></div>`;
    item.addEventListener('click', (e) => {
      if (e.target.closest('.cust-edit')) return;
      const box = item.querySelector('.cust-edit');
      if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
      document.querySelectorAll('.cust-edit').forEach((b) => b.classList.add('hidden'));
      buildCustomerEditor_(box, c);
      box.classList.remove('hidden');
    });
    wrap.appendChild(item);
  });
  if (list.length > 100) {
    const more = el('div', 'empty-note');
    more.textContent = 'فقط ۱۰۰ نفر اول نمایش داده شد؛ با جستجو محدودتر کن.';
    wrap.appendChild(more);
  }
}

function buildCustomerEditor_(box, c) {
  const stored = /^([jg]):(\d{2})-(\d{2})$/.exec(c.birthday || '');
  const cal = stored ? stored[1] : (adminCalendarType === 'gregorian' ? 'g' : 'j');
  const names = cal === 'j' ? JALALI_MONTHS_FA : GREG_MONTHS_FA;
  const selStyle = "border:2px solid var(--line); border-radius:10px; padding:10px; font-family:'Vazirmatn'; background:var(--paper);";
  const monthOpts = '<option value="">ماه</option>' + names.map((n, i) => `<option value="${i + 1}" ${stored && Number(stored[2]) === i + 1 ? 'selected' : ''}>${n}</option>`).join('');
  let dayOpts = '<option value="">روز</option>';
  for (let d = 1; d <= 31; d++) dayOpts += `<option value="${d}" ${stored && Number(stored[3]) === d ? 'selected' : ''}>${d}</option>`;
  const tags = ['', 'VIP', 'عادی', 'ناراضی'];
  box.innerHTML = `
    <div class="field"><label>تاریخ تولد (${cal === 'j' ? 'شمسی' : 'میلادی'})</label>
      <div style="display:flex; gap:8px;">
        <select class="c-month" style="${selStyle} flex:1;">${monthOpts}</select>
        <select class="c-day" style="${selStyle} flex:1;">${dayOpts}</select>
      </div>
    </div>
    <div class="field"><label>برچسب</label>
      <select class="c-tag" style="${selStyle} width:100%;">${tags.map((t) => `<option value="${t}" ${c.tag === t ? 'selected' : ''}>${t || 'بدون برچسب'}</option>`).join('')}</select>
    </div>
    <div class="field"><label>یادداشت (فقط برای خودت)</label>
      <textarea class="c-note" rows="2" style="width:100%; border:2px solid var(--line); border-radius:12px; padding:10px; font-family:'Vazirmatn';">${escHtml(c.note)}</textarea>
    </div>
    <label style="display:flex; gap:8px; align-items:center; font-size:12.5px; margin-bottom:10px;"><input type="checkbox" class="c-reset"> هدیه‌ی تولد امسال دوباره فعال شود</label>
    <button class="btn btn-block c-save">ذخیره</button>
    <div class="field" style="margin-top:14px;"><label>پیام تلگرام به همین مشتری</label>
      <textarea class="c-msg" rows="2" style="width:100%; border:2px solid var(--line); border-radius:12px; padding:10px; font-family:'Vazirmatn';"></textarea>
    </div>
    <button class="btn btn-block btn-ghost c-send">ارسال پیام</button>
    <div class="c-status" style="font-size:12.5px; color:var(--muted); margin-top:8px;"></div>`;
  const status = box.querySelector('.c-status');
  box.querySelector('.c-save').addEventListener('click', async (e) => {
    const m = box.querySelector('.c-month').value;
    const d = box.querySelector('.c-day').value;
    if ((m && !d) || (!m && d)) { status.textContent = 'ماه و روز هر دو باید انتخاب بشن.'; return; }
    const btn = e.currentTarget;
    btn.disabled = true;
    const birthday = m ? `${cal}:${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
    const res = await api('adminSaveCustomer', {
      phone: c.phone, birthday, tag: box.querySelector('.c-tag').value,
      note: box.querySelector('.c-note').value, resetGift: box.querySelector('.c-reset').checked ? '1' : '0'
    });
    btn.disabled = false;
    status.textContent = res.ok ? 'ذخیره شد ✅' : (res.error || 'خطا');
    if (res.ok) { await loadCustomers(); }
  });
  box.querySelector('.c-send').addEventListener('click', async (e) => {
    const text = box.querySelector('.c-msg').value.trim();
    if (!text) { status.textContent = 'متن پیام رو بنویس.'; return; }
    const btn = e.currentTarget;
    btn.disabled = true;
    const res = await api('adminMessageCustomers', { phones: c.phone, text });
    btn.disabled = false;
    status.textContent = res.ok && res.sent ? 'پیام فرستاده شد ✅' : (res.error || 'نشد؛ احتمالاً مشتری بات رو بلاک کرده');
  });
}

$('#cust-search').addEventListener('input', renderCustomers);
$('#cust-filter').addEventListener('change', renderCustomers);

$('#cust-bulk-btn').addEventListener('click', async () => {
  const list = filteredCustomers_();
  const text = $('#cust-bulk-text').value.trim();
  const status = $('#cust-bulk-status');
  if (!text) { status.textContent = 'متن پیام رو بنویس.'; return; }
  if (list.length === 0) { status.textContent = 'فهرست خالیه.'; return; }
  if (!confirm('این پیام برای ' + list.length + ' نفر فرستاده میشه. مطمئنی؟')) return;
  const btn = $('#cust-bulk-btn');
  btn.disabled = true;
  let sent = 0;
  for (let i = 0; i < list.length; i += 30) {
    const chunk = list.slice(i, i + 30).map((c) => c.phone).join(',');
    status.textContent = 'در حال ارسال... ' + Math.min(i + 30, list.length) + ' از ' + list.length;
    const res = await api('adminMessageCustomers', { phones: chunk, text });
    if (res.ok) sent += res.sent;
  }
  btn.disabled = false;
  status.textContent = 'به ' + sent + ' نفر فرستاده شد ✅';
});

// ----------------------------- init -----------------------------
if (token) showPanel();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('admin-sw.js', { scope: 'admin.html' }).catch(() => {});
}
