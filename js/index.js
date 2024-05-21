// 切换第N周的日程表
var weekIndex = localStorage.getItem('weekIndex')
if (weekIndex === null) localStorage.setItem('weekIndex', '0')
weekIndex = Number(localStorage.getItem('weekIndex'))

// 时间偏移
var timeOffset = localStorage.getItem('timeOffset')
if (timeOffset === null) localStorage.setItem('timeOffset', '0')
timeOffset = Number(localStorage.getItem('timeOffset'))

var dayOffset = localStorage.getItem('dayOffset')
if (dayOffset === null) localStorage.setItem('dayOffset', '-1')
dayOffset = Number(localStorage.getItem('dayOffset'))

var setDayOffsetLastDay = localStorage.getItem('setDayOffsetLastDay')
if (setDayOffsetLastDay === null) localStorage.setItem('setDayOffsetLastDay', '-1')
setDayOffsetLastDay = Number(localStorage.getItem('setDayOffsetLastDay'))

// 获取经过偏移的时间
function getCurrentEditedDate() {
    let d = new Date();
    d.setSeconds(d.getSeconds() + timeOffset)
    return d;
}

// 获取周期
function getCurrentEditedDay(date) {
    if (dayOffset === -1) 
        return date.getDay();
    if (setDayOffsetLastDay == new Date().getDay()) {
        return dayOffset;
    }
    localStorage.setItem('dayOffset', '-1')
    localStorage.setItem('setDayOffsetLastDay', '-1')
    dayOffset = -1
    setDayOffsetLastDay = -1
    return date.getDay();
}

function isBreakTime(startTime, endTime, currentTime) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const [currentH, currentM] = currentTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const currentMinutes = currentH * 60 + currentM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getNextClassIndex(timetable, currentIndex) {
    // 从当前时间点的下一个时间段开始，找到下一个课程的索引
    const timeKeys = Object.keys(timetable);
    for (let i = currentIndex + 1; i < timeKeys.length; i++) {
        if (typeof timetable[timeKeys[i]] === 'number') {
            return timetable[timeKeys[i]];
        }
    }
    return null; // 如果没有下一堂课，返回 null
}

function getCurrentDaySchedule() {
    const date = getCurrentEditedDate();
    const dayOfWeek = getCurrentEditedDay(date); // 0 = Sunday, 1 = Monday, ...
    const weekNumber = weekIndex; // 当前周数
    const dailyClass = scheduleConfig.daily_class[dayOfWeek];
    if (!dailyClass) return [];
    // 对有不同周安排的课程重排，获得一天全部日程
    return dailyClass.classList.map(subject => {
        if (Array.isArray(subject)) {
            return subject[weekNumber]; // 处理每周不同的课程
        }
        return subject;
    });
}

// 检查当前是否为上课期间
function isClassCurrent(startTime, endTime, currentTime) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const [currentH, currentM] = currentTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const currentMinutes = currentH * 60 + currentM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getCurrentTime() {
    const now = getCurrentEditedDate();
    return [
        now.getHours().toString().padStart(2, '0'),
        now.getMinutes().toString().padStart(2, '0'),
        now.getSeconds().toString().padStart(2, '0')
    ].join(':');
}

function getScheduleData() {
    const currentSchedule = getCurrentDaySchedule();
    // 格式化时间，格式如下
    const currentTime = getCurrentTime();
    // let currentTime = '07:10:01';
    const dayOfWeek = getCurrentEditedDay(getCurrentEditedDate());
    // 获得时间表种类
    const timetable = scheduleConfig.daily_class[dayOfWeek].timetable
    // 根据时间表种类找到时间表
    const dayTimetable = scheduleConfig.timetable[timetable];
    // 找到分割栏
    const divider = scheduleConfig.divider[timetable];
    let scheduleArray = [];
    let currentHighlight = { index: null, type: null, fullName: null, countdown: null, countdownText: null };
    Object.keys(dayTimetable).forEach((timeRange, index) => {
        const [startTime, endTime] = timeRange.split('-');
        const classIndex = dayTimetable[timeRange];
        
        // 数字：课程类型
        if (typeof classIndex === 'number') {
            // 在课程表里按照索引找课程缩写
            const subjectShortName = currentSchedule[classIndex];
            // 再通过缩写找全称
            const subjectFullName = scheduleConfig.subject_name[subjectShortName];
            scheduleArray.push(subjectShortName);

            // 上课期间
            if (isClassCurrent(startTime, endTime, currentTime)) {
                currentHighlight.index = scheduleArray.length - 1;
                currentHighlight.type = 'current';
                currentHighlight.fullName = subjectFullName;
                currentHighlight.countdown = calculateCountdown(endTime, currentTime);
                currentHighlight.countdownText = formatCountdown(currentHighlight.countdown);
            }
        } else if (currentHighlight.index === null && isBreakTime(startTime, endTime, currentTime)) {
            let highlighted = false;
            // 重复查找，直到找到下一个课程
            for (let i = index + 1; i < Object.keys(dayTimetable).length; i++) {
                const nextTimeRange = Object.keys(dayTimetable)[i];
                const nextClassIndex = dayTimetable[nextTimeRange];
                if (typeof nextClassIndex === 'number') {
                    currentHighlight.index = scheduleArray.length;
                    currentHighlight.type = 'upcoming';
                    const nextSubjectShortName = currentSchedule[nextClassIndex];
                    const nextSubjectFullName = scheduleConfig.subject_name[nextSubjectShortName];
                    currentHighlight.fullName = dayTimetable[timeRange];
                    const [nextStartTime] = nextTimeRange.split('-');
                    currentHighlight.countdown = calculateCountdown(timeRange.split('-')[1], currentTime);
                    currentHighlight.countdownText = formatCountdown(currentHighlight.countdown);
                    highlighted = true;
                    break;
                }
            }
            // 没找到
            if (!highlighted) {
                currentHighlight.index = currentSchedule.length - 1;
                currentHighlight.type = 'upcoming';
                currentHighlight.fullName = dayTimetable[timeRange];
                currentHighlight.countdown = calculateCountdown(timeRange.split('-')[1], currentTime);
                currentHighlight.countdownText = formatCountdown(currentHighlight.countdown);
                currentHighlight.isEnd = true;
            }
        } else if (currentHighlight.index === null && !dayTimetable[timeRange]) {
            // 当前时间是非课程时间（如课间休息）
            currentHighlight.fullName = currentSchedule[classIndex]; // 使用时间表中的描述
        }
    });
    return { scheduleArray, currentHighlight, timetable, divider };
}

// 计算倒计时时间，返回秒
function calculateCountdown(targetTime, currentTime) {
    const [targetH, targetM] = targetTime.split(':').map(Number);
    const [currentH, currentM, currentS = '00'] = currentTime.split(':').map(Number);

    const targetTotalSeconds = targetH * 3600 + (targetM + 1) * 60;
    const currentTotalSeconds = currentH * 3600 + currentM * 60 + currentS;

    return targetTotalSeconds - currentTotalSeconds;
}

// 秒转格式化文本
function formatCountdown(countdownSeconds) {
    const minutes = Math.floor(countdownSeconds / 60);
    const seconds = countdownSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

