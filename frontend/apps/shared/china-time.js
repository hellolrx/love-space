const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function toDate(input = new Date()) {
    const date = input instanceof Date ? input : new Date(input);
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

function pad(value) {
    return String(value).padStart(2, '0');
}

export function getChinaDateParts(input = new Date()) {
    const shifted = new Date(toDate(input).getTime() + CHINA_OFFSET_MS);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
        second: shifted.getUTCSeconds(),
        weekday: shifted.getUTCDay()
    };
}

export function toChinaDateISO(input = new Date()) {
    const parts = getChinaDateParts(input);
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function chinaDateSerial(input = new Date()) {
    const parts = getChinaDateParts(input);
    return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS;
}

export function diffChinaCalendarDays(later = new Date(), earlier = new Date()) {
    return Math.floor(chinaDateSerial(later) - chinaDateSerial(earlier));
}

export function isSameChinaDay(a, b = new Date()) {
    return toChinaDateISO(a) === toChinaDateISO(b);
}

export function formatChinaTime(input = new Date()) {
    const parts = getChinaDateParts(input);
    return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatChinaMonthDay(input = new Date()) {
    const parts = getChinaDateParts(input);
    return `${pad(parts.month)}/${pad(parts.day)}`;
}

export function formatChinaDateTimeFull(input = new Date()) {
    const parts = getChinaDateParts(input);
    return `${parts.year}/${pad(parts.month)}/${pad(parts.day)} ${WEEKDAYS[parts.weekday]} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatChinaWeekdayTime(input = new Date()) {
    const parts = getChinaDateParts(input);
    return `${WEEKDAYS[parts.weekday]} ${pad(parts.hour)}:${pad(parts.minute)}`;
}
