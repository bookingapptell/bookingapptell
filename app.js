// =====================================================================
// این خط را بعد از دیپلوی Apps Script با آدرس exec خودت جایگزین کن
// =====================================================================
const API_BASE = 'https://script.google.com/macros/s/AKfycbzWLPgSboFo7wzKlgFN8az3nehWEVrwX_ud21BzAl1R8cJCQPAR26UAClhMplTAcECb/exec';

const state = {
  services: [],
  selectedService: null,
  selectedDate: null,
  selectedTime: null,
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const PERSIAN_DOW_SHORT = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

function toman(n) {
  return Number(n).toLocaleString('fa-IR') + ' تومان';
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3200);
}

async function api(action, params = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  Object.keys(params).forEach((k) => url.searchParams.set(k, params[k]));
  const res = await fetch(url.toString());
  return res.json();
}

let CATEGORIES = [];

// ----------------------------- خدمات -----------------------------
async function loadServices() {
  const [servicesData, categoriesData] = await Promise.all([
    api('getServices'),
    api('getCategories'),
  ]);
  if (!servicesData.ok) { toast('خطا در دریافت خدمات'); return; }
  state.services = servicesData.services;
  CATEGORIES = categoriesData.ok ? categoriesData.categories : [];
  renderCategoryGrid();
}

function renderCategoryGrid() {
  const grid = $('#category-grid');
  grid.innerHTML = '';
  if (CATEGORIES.length === 0) {
    grid.innerHTML = '<div class="empty-note" style="grid-column: 1 / -1;">هنوز دسته‌بندی‌ای تعریف نشده</div>';
    return;
  }
  CATEGORIES.forEach((cat) => {
    const card = el('div', 'category-card', `<div class="emoji">${cat.emoji}</div><div class="label">${cat.label}</div>`);
    card.addEventListener('click', () => selectCategory(cat));
    grid.appendChild(card);
  });
}

function selectCategory(cat) {
  $('#category-grid').classList.add('hidden');
  $('#category-menu-label').textContent = `${cat.emoji} ${cat.label} (تغییر دسته)`;
  renderServicesForCategory(cat.key);
}

$('#category-menu-toggle').addEventListener('click', () => {
  $('#category-grid').classList.toggle('hidden');
});

function renderServicesForCategory(categoryKey) {
  const wrap = $('#services');
  const filtered = state.services.filter((s) => s.category === categoryKey);
  wrap.innerHTML = '';
  if (filtered.length === 0) {
    wrap.innerHTML = '<div class="empty-note">فعلاً خدمتی توی این دسته تعریف نشده</div>';
    return;
  }
  filtered.forEach((s) => {
    const isPayInPerson = String(s.payInPerson).toUpperCase() === 'TRUE';
    const card = el('div', 'service-card');
    if (s.imageUrl) {
      const pos = s.imagePosition || 'center';
      card.style.backgroundImage = `linear-gradient(to left, rgba(255,255,255,0.88) 35%, rgba(255,255,255,0.35)), url('${s.imageUrl}')`;
      card.style.backgroundSize = 'cover';
      card.style.backgroundPosition = `center ${pos}`;
    }
    const staffAvatar = s.staffImageUrl ? `<img class="staff-avatar" src="${s.staffImageUrl}">` : '';
    const staffLine = s.staffName ? ` · ${s.staffName}` : '';
    const locationPin = s.locationUrl ? `
      <button type="button" class="location-pin-btn" style="background:none; border:none; padding:6px; cursor:pointer; margin-top:4px;">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--blush-deep)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </button>` : '';
    card.innerHTML = `
      <div>
        <div class="name">${s.name}</div>
        <div class="meta">${staffAvatar}${s.duration} دقیقه${isPayInPerson ? ' · پرداخت حضوری' : ''}${staffLine}</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
        <div class="price">${toman(s.price)}</div>
        ${locationPin}
      </div>
    `;
    if (s.locationUrl) {
      card.querySelector('.location-pin-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const url = /^https?:\/\//i.test(s.locationUrl) ? s.locationUrl : 'https://' + s.locationUrl;
        window.open(url, '_blank', 'noopener');
      });
    }
    card.addEventListener('click', () => selectService(s, card));
    wrap.appendChild(card);
  });
}

function selectService(service, cardEl) {
  document.querySelectorAll('.service-card').forEach((c) => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  state.selectedService = service;
  state.selectedTime = null;
  $('#date-section').classList.remove('hidden');
  buildDateScroller();
  updatePayBar();
}

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

// نوع تقویمی که از برندینگ میاد: 'jalali' یا 'gregorian'
let calendarType = 'jalali';
let depositPercent = 0;

// برای یه شیء Date، عدد روزی که باید روی چیپ نشون داده بشه رو برمی‌گردونه
function dayNumberFor_(d) {
  if (calendarType === 'gregorian') return toPersianDigits_(d.getDate());
  const j = toJalali_(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return toPersianDigits_(j.jd);
}

// فرمت کامل تاریخ (مثلاً ۱۴۰۵-۰۸-۲۰ یا ۲۰۲۶-۱۱-۱۱ بسته به تنظیم تقویم)
function fullDateFor_(iso) {
  const [gy, gm, gd] = iso.split('-').map(Number);
  if (calendarType === 'gregorian') {
    return `${gy}/${String(gm).padStart(2, '0')}/${String(gd).padStart(2, '0')}`;
  }
  const j = toJalali_(gy, gm, gd);
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}

// ----------------------------- تاریخ -----------------------------
function buildDateScroller() {
  const wrap = $('#date-scroller');
  wrap.innerHTML = '';
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = toLocalDateStr_(d);
    const chip = el('div', 'date-chip');
    chip.innerHTML = `<div class="dow">${PERSIAN_WEEKDAYS[d.getDay()]}</div><div class="dom">${dayNumberFor_(d)}</div>`;
    chip.addEventListener('click', () => selectDate(iso, chip));
    wrap.appendChild(chip);
  }
}

async function selectDate(iso, chipEl) {
  document.querySelectorAll('.date-chip').forEach((c) => c.classList.remove('selected'));
  chipEl.classList.add('selected');
  state.selectedDate = iso;
  state.selectedTime = null;
  $('#time-section').classList.remove('hidden');

  $('#selected-date-summary').textContent = fullDateFor_(iso);

  const grid = $('#slot-grid');
  grid.innerHTML = '<div class="empty-note">در حال بررسی ساعت‌های خالی...</div>';
  updatePayBar();

  const data = await api('getAvailability', { date: iso });
  grid.innerHTML = '';
  if (!data.ok || data.slots.length === 0) {
    grid.innerHTML = '<div class="empty-note">برای این روز نوبت خالی نیست 🌙</div>';
    return;
  }
  data.slots.forEach((t) => {
    const slot = el('div', 'slot', t);
    slot.addEventListener('click', () => selectTime(t, slot));
    grid.appendChild(slot);
  });
}

function selectTime(t, slotEl) {
  document.querySelectorAll('.slot').forEach((s) => s.classList.remove('selected'));
  slotEl.classList.add('selected');
  state.selectedTime = t;
  $('#form-section').classList.remove('hidden');
  updatePayBar();
}

// ----------------------------- فرم و پرداخت -----------------------------
function updatePayBar() {
  const bar = $('#pay-bar');
  const ready = state.selectedService && state.selectedDate && state.selectedTime;
  if (!ready) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const isPayInPerson = String(state.selectedService.payInPerson).toUpperCase() === 'TRUE';
  const disc = state.discount;
  const finalPrice = disc ? Math.round(Number(state.selectedService.price) * (100 - disc.percent) / 100) : Number(state.selectedService.price);
  $('#total-amount').innerHTML = disc
    ? `<s style="opacity:.55;font-size:.8em">${toman(state.selectedService.price)}</s> ${toman(finalPrice)}<br><small>🎁 ${disc.label} ${disc.percent}٪</small>`
    : toman(state.selectedService.price);
  if (!isPayInPerson && depositPercent > 0 && depositPercent < 100) {
    const dep = Math.round(finalPrice * depositPercent / 100);
    $('#total-amount').innerHTML += `<br><small>بیعانه ${toman(dep)} (${depositPercent}٪) — باقی‌مانده حضوری</small>`;
  }
  document.querySelector('.pay-bar .total-label').textContent = isPayInPerson ? 'پرداخت حضوری' : 'مبلغ قابل پرداخت';
  $('#submit-btn').textContent = isPayInPerson ? 'ثبت نوبت' : 'پرداخت و ثبت نوبت';
}

async function submitBooking() {
  const name = $('#customer-name').value.trim();
  const phone = $('#customer-phone').value.trim();
  if (!name || !phone) { toast('لطفاً نام و شماره تماس را وارد کن'); return; }
  if (!/^09\d{9}$/.test(phone)) { toast('شماره موبایل را درست وارد کن'); return; }

  const btn = $('#submit-btn');
  btn.disabled = true;
  btn.innerHTML = 'در حال ثبت... <span class="spinner"></span>';

  const created = await api('createBooking', {
    serviceId: state.selectedService.id,
    date: state.selectedDate,
    time: state.selectedTime,
    name, phone,
  });

  if (!created.ok) {
    toast(created.error || 'خطا در ثبت نوبت');
    btn.disabled = false;
    btn.textContent = 'پرداخت و ثبت نوبت';
    return;
  }

  saveReceipt_({
    bookingId: created.bookingId,
    serviceName: created.serviceName,
    amount: created.amount,
    date: state.selectedDate,
    time: state.selectedTime,
    customerName: name,
    customerPhone: phone,
    status: created.payInPerson ? 'confirmed' : 'pending',
    createdAt: new Date().toISOString(),
  });

  if (created.payInPerson) {
    window.location.href = `result.html?status=success&inperson=1&bookingId=${created.bookingId}`;
    return;
  }

  const payment = await api('startPayment', { bookingId: created.bookingId });
  if (!payment.ok) {
    toast(payment.error || 'خطا در اتصال به درگاه پرداخت');
    btn.disabled = false;
    btn.textContent = 'پرداخت و ثبت نوبت';
    return;
  }

  window.location.href = payment.paymentUrl;
}

// رسید رزرو رو توی حافظه‌ی همین گوشی ذخیره می‌کنه تا مشتری بعداً بتونه ببینتش
function saveReceipt_(receipt) {
  try {
    localStorage.setItem('receipt_' + receipt.bookingId, JSON.stringify(receipt));
    const list = JSON.parse(localStorage.getItem('receipts_list') || '[]');
    if (!list.includes(receipt.bookingId)) {
      list.unshift(receipt.bookingId);
      localStorage.setItem('receipts_list', JSON.stringify(list.slice(0, 30)));
    }
  } catch (e) { /* اگه حافظه‌ی مرورگر پر بود، مشکلی برای ادامه‌ی رزرو پیش نمیاد */ }
}

// ----------------------------- برندینگ -----------------------------
async function loadBranding() {
  try {
    const data = await api('getBrandSettings');
    if (!data.ok) return;

    if (data.calendarType) calendarType = data.calendarType;
    depositPercent = Number(data.depositPercent) || 0;
    if (data.telegramBotUsername) telegramBotUsername = data.telegramBotUsername;

    if (data.brandName) {
      $('#brand-name').textContent = data.brandName;
      document.title = data.brandName + ' — رزرو نوبت';
    }
    if (data.heroTitle) $('#hero-title').textContent = data.heroTitle;
    if (data.heroSubtitle) $('#hero-subtitle').textContent = data.heroSubtitle;
    if (data.brandColor) {
      document.documentElement.style.setProperty('--blush', data.brandColor);
      document.documentElement.style.setProperty('--blush-deep', data.brandColor);
    }
    if (data.logoUrl) {
      $('#brand-logo-wrap').innerHTML = `<img src="${data.logoUrl}" alt="لوگو" style="width:52px; height:52px; border-radius:50%; object-fit:cover; margin-bottom:12px; border:2px solid rgba(199,161,92,0.5);">`;
    }
    if (data.heroImageUrl) {
      const hero = $('#hero-box');
      hero.style.backgroundImage = `linear-gradient(160deg, rgba(42,27,46,0.86) 0%, rgba(61,42,66,0.82) 55%, rgba(71,47,78,0.8) 100%), url('${data.heroImageUrl}')`;
      hero.style.backgroundSize = 'cover';
      hero.style.backgroundPosition = 'center';
    }
    if (data.instagramUrl) {
      const link = $('#instagram-link');
      link.href = data.instagramUrl;
      link.classList.remove('hidden');
    }
    if (data.phoneNumber) {
      const link = $('#phone-link');
      link.href = `tel:${data.phoneNumber}`;
      link.classList.remove('hidden');
    }
    if (data.backgroundUrl) {
      document.body.style.backgroundImage = `linear-gradient(rgba(251,246,243,0.35), rgba(251,246,243,0.55)), url('${data.backgroundUrl}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'top center';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.backgroundRepeat = 'no-repeat';
    }
  } catch (e) { /* برندینگ اختیاریه، اگه نشد مشکلی نیست */ }
}

// ----------------------------- ورود مشتری با تلگرام -----------------------------
let telegramBotUsername = '';
let customerToken = localStorage.getItem('customerToken') || '';
let customerPhone = localStorage.getItem('customerPhone') || '';

$('#cust-send-btn').addEventListener('click', async () => {
  const phone = $('#cust-phone').value.trim();
  if (!/^09\d{9}$/.test(phone)) { toast('شماره موبایل رو درست وارد کن'); return; }
  const btn = $('#cust-send-btn');
  btn.disabled = true;
  btn.textContent = 'در حال ارسال...';
  const res = await api('customerRequestOtp', { phone });
  btn.disabled = false;
  btn.textContent = 'ارسال کد تایید';

  if (!res.ok) {
    if (res.needsTelegramSetup) {
      const note = $('#telegram-setup-note');
      note.classList.remove('hidden');
      if (telegramBotUsername) {
        $('#telegram-bot-link').href = `https://t.me/${telegramBotUsername}`;
      }
    }
    toast(res.error || 'ارسال کد ناموفق بود');
    return;
  }

  customerPhone = phone;
  $('#login-step-phone').classList.add('hidden');
  $('#login-step-code').classList.remove('hidden');
  toast('کد تایید توی تلگرامت فرستاده شد ✅');
});

$('#cust-verify-btn').addEventListener('click', async () => {
  const code = $('#cust-code').value.trim();
  if (!code) { toast('کد رو وارد کن'); return; }
  const btn = $('#cust-verify-btn');
  btn.disabled = true;
  btn.textContent = 'در حال بررسی...';
  const res = await api('customerVerifyOtp', { phone: customerPhone, code });
  btn.disabled = false;
  btn.textContent = 'ورود';
  if (!res.ok) { toast(res.error || 'کد اشتباهه'); return; }

  customerToken = res.token;
  customerPhone = res.phone;
  localStorage.setItem('customerToken', customerToken);
  localStorage.setItem('customerPhone', customerPhone);
  enterApp_();
});

$('#cust-resend-btn').addEventListener('click', async () => {
  const res = await api('customerRequestOtp', { phone: customerPhone });
  toast(res.ok ? 'کد دوباره فرستاده شد' : (res.error || 'ارسال ناموفق بود'));
});

function enterApp_() {
  $('#login-gate').classList.add('hidden');
  $('#app-content').classList.remove('hidden');
  const phoneField = $('#customer-phone');
  if (phoneField) phoneField.value = customerPhone;
  $('#cust-username-badge').textContent = customerPhone;
  loadServices();
  loadProfile_();
}

// اسم ثبت‌شده‌ی مشتری رو از سرور می‌گیره؛ توی فرم قفل میشه (فقط مدیر می‌تونه عوضش کنه)
async function loadProfile_() {
  try {
    api('getMyDiscount', { token: customerToken }).then((d) => { state.discount = d.ok ? d.discount : null; updatePayBar(); }).catch(() => {});
    const r = await api('getMyProfile', { token: customerToken });
    const f = $('#customer-name');
    if (!r.ok || !f) return;
    if (r.nameSet) {
      f.value = r.name;
      f.readOnly = true;
      f.style.background = 'var(--line)';
      f.style.color = 'var(--muted)';
    } else {
      toast('قبل از رزرو، توی بات تلگرام اسم و فامیلت رو ثبت کن (/start)');
    }
  } catch (e) { /* مهم نیست؛ سرور موقع ثبت نوبت دوباره چک می‌کنه */ }
}

$('#cust-logout-btn').addEventListener('click', () => {
  localStorage.removeItem('customerToken');
  localStorage.removeItem('customerPhone');
  window.location.reload();
});

// ----------------------------- init -----------------------------
window.addEventListener('DOMContentLoaded', () => {
  loadBranding();
  $('#submit-btn').addEventListener('click', submitBooking);

  if (customerToken && customerPhone) {
    enterApp_();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
  }
});
