import { Auth } from '../home/js/auth.js';
import { Calendar } from '../timeline/script.js?v=timeline-clear-1';
import { LoadingScreen } from '../load/loading.js?v=load-4';

async function initCalendarPage() {
    const loggedIn = await Auth.init();
    if (!loggedIn) {
        LoadingScreen.goTo('../../');
        return;
    }

    window.app = {
        changeMonth: (offset) => Calendar.changeMonth(offset),
        closeDateModal: () => Calendar.closeDateModal(),
        toggleScheduleForm: () => Calendar.toggleScheduleForm(),
        addSchedule: () => Calendar.addSchedule(),
        completeSchedule: (id) => Calendar.completeSchedule(id)
    };

    await Calendar.initCalendar();
}

LoadingScreen.withLoading(initCalendarPage).catch(error => {
    console.error(error);
    alert('月历加载失败：' + (error.message || '未知错误'));
});
