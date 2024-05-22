const { app, BrowserWindow, Menu, ipcMain, dialog, screen, Tray, shell } = require('electron')
const path = require('path');
const fs = require('fs')
const os = require('os')
const createShortcut = require('windows-shortcuts')
// 启动文件夹 用于开机自启动
const startupFolderPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
// 桌面
const desktopFolderPath = path.join(os.homedir(), 'Desktop')
const prompt = require('electron-prompt');
const Store = require('electron-store');
const { DisableMinimize } = require('electron-disable-minimize');
const store = new Store();
let tray = undefined;
let form = undefined;
var win = undefined;
let template = []
let basePath = app.isPackaged ? './resources/app/' : './'

// 检查是否已经有一个实例在运行，否则退出
if (!app.requestSingleInstanceLock({ key: 'classSchedule' })) {
    app.quit();
}

const createWindow = () => {
    win = new BrowserWindow({
        x: 0,
        y: 0,
        width: screen.getPrimaryDisplay().workAreaSize.width,
        height: 200,
        frame: false,
        transparent: true,
        alwaysOnTop: store.get('isWindowAlwaysOnTop', true),
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
        resizable: false,
        type: 'toolbar',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
    })
    // win.webContents.openDevTools()
    win.loadFile('index.html')
    if (store.get('isWindowAlwaysOnTop', true))
        win.setAlwaysOnTop(true, 'screen-saver', 9999999999999)
}

// 开机自启动
function setAutoLaunch() {
    const shortcutName = '电子课表(请勿重命名).lnk'
    app.setLoginItemSettings({ // backward compatible
        openAtLogin: false,
        openAsHidden: false
    })
    if (store.get('isAutoLaunch', true)) {
        createShortcut.create(startupFolderPath + '/' + shortcutName,
            {
                target: app.getPath('exe'),
                workingDir: app.getPath('exe').split('\\').slice(0, -1).join('\\'),
            }, (e) => { e && console.log(e); })
    } else {
        fs.unlink(startupFolderPath + '/' + shortcutName, () => { })
    }

}

// 只有ready后才能创建窗口
app.whenReady().then(() => {
    // 创建
    createWindow()
    // 移除上方菜单栏
    Menu.setApplicationMenu(null)
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('getWeekIndex');
    })
    const handle = win.getNativeWindowHandle();
    // 禁止最小化（Win + D）
    DisableMinimize(handle); // Thank to peter's project https://github.com/tbvjaos510/electron-disable-minimize
    setAutoLaunch()
})

// 画板功能
function createDrawWindow() {
    let drawer = new BrowserWindow({
        width: 300,
        height: 200,
        frame: false,
        transparent: true,
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
        resizable: true,
        type: 'toolbar',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    drawer.loadFile('drawer.html');

    // drawer.webContents.openDevTools();

    drawer.webContents.on('context-menu', (e,p) => {
        let menu = Menu.buildFromTemplate([
            {label: '关闭', click: () => {
                drawer.close()
                drawer = null;
            }},
            {label: '固定', click: () => {
                dialog.showMessageBox(win, {
                    title: '请确认',
                    message: '固定后将无法移动或关闭，确定要固定窗口吗?',
                    buttons: ['取消', '确定']
                }).then((data) => {
                    if (data.response) drawer.setIgnoreMouseEvents(true);
                })
            }}
        ]);
        menu.popup();
    })

    drawer.webContents.on('did-finish-load', () => {
        dialog.showOpenDialog(drawer, {
            title: '选择一个HTML格式文本',
            defaultPath: desktopFolderPath,
            filters: [
                {name: '文本文档', extensions: ['txt']},
                {name: 'HTML文件', extensions: ['html']}
            ],
            properties: [
                'openFile'
            ]
        }).then(result => {
            if (result.canceled){
                drawer.close();
                drawer = null;
                return;
            }
            fs.readFile(result.filePaths[0], (e, data) => {
                if (e){
                    drawer.close();
                    drawer = null;
                    return;
                }
                drawer.webContents.send('setDivHtml', data.toString());
            })
        })
    });
}

ipcMain.on('getWeekIndex', (e, arg) => {
    tray = new Tray(basePath + 'image/icon.png')
    template = [
        {
            label: '第一周',
            type: 'radio',
            click: () => {
                win.webContents.send('setWeekIndex', 0)
            }
        },
        {
            label: '第二周',
            type: 'radio',
            click: () => {
                win.webContents.send('setWeekIndex', 1)
            }
        },
        {
            label: '第三周',
            type: 'radio',
            click: () => {
                win.webContents.send('setWeekIndex', 2)
            }
        },
        {
            label: '第四周',
            type: 'radio',
            click: () => {
                win.webContents.send('setWeekIndex', 3)
            }
        },
        {
            type: 'separator'
        },
        {
            icon: basePath + 'image/drawing.png',
            label: '新建HTML画板',
            click: () => createDrawWindow()
        },
        {
            icon: basePath + 'image/setting.png',
            label: '配置课表',
            click: () => {
                win.webContents.send('openSettingDialog')
            }
        },
        {
            icon: basePath + 'image/clock.png',
            label: '矫正计时',
            click: () => {
                win.webContents.send('getTimeOffset')
            }
        },
        {
            icon: basePath + 'image/toggle.png',
            label: '切换日程',
            click: () => {
                win.webContents.send('setDayOffset')
            }
        },
        {
            icon: basePath + 'image/github.png',
            label: '源码仓库',
            click: () => {
                shell.openExternal('https://github.com/integralAva/ElectronClassSchedule');
            }
        },
        {
            type: 'separator'
        },
        {
            id: 'countdown',
            label: '课上计时',
            type: 'checkbox',
            checked: store.get('isDuringClassCountdown', true),
            click: (e) => {
                store.set('isDuringClassCountdown', e.checked)
                win.webContents.send('ClassCountdown', e.checked)
            }
        },
        {
            label: '窗口置顶',
            type: 'checkbox',
            checked: store.get('isWindowAlwaysOnTop', true),
            click: (e) => {
                store.set('isWindowAlwaysOnTop', e.checked)
                if (store.get('isWindowAlwaysOnTop', true))
                    win.setAlwaysOnTop(true, 'screen-saver', 9999999999999)
                else
                    win.setAlwaysOnTop(false)
            }
        },
        {
            label: '上课隐藏',
            type: 'checkbox',
            checked: store.get('isDuringClassHidden', true),
            click: (e) => {
                store.set('isDuringClassHidden', e.checked)
                win.webContents.send('ClassHidden', e.checked)
            }
        },
        {
            label: '开机启动',
            type: 'checkbox',
            checked: store.get('isAutoLaunch', true),
            click: (e) => {
                store.set('isAutoLaunch', e.checked)
                setAutoLaunch()
            }
        },
        {
            type: 'separator'
        },
        {
            icon: basePath + 'image/quit.png',
            label: '退出程序',
            click: () => {
                dialog.showMessageBox(win, {
                    title: '请确认',
                    message: '你确定要退出程序吗?',
                    buttons: ['取消', '确定']
                }).then((data) => {
                    if (data.response) app.quit()
                })
            }
        }
    ]
    // 将第N周的click设为clicked
    template[arg].checked = true
    form = Menu.buildFromTemplate(template)
    tray.setToolTip('电子课表 - by lsl & integralAva')
    function trayClicked() {
        tray.popUpContextMenu(form)
    }
    tray.on('click', trayClicked)
    tray.on('right-click', trayClicked)
    tray.setContextMenu(form)
    win.webContents.send('ClassCountdown', store.get('isDuringClassCountdown', true))
    win.webContents.send('ClassHidden', store.get('isDuringClassHidden', true))
})

ipcMain.on('log', (e, arg) => {
    console.log(arg);
})

ipcMain.on('setIgnore', (e, arg) => {
    if (arg)
        win.setIgnoreMouseEvents(true, { forward: true });
    else
        win.setIgnoreMouseEvents(false);
})

ipcMain.on('dialog', (e, arg) => {
    dialog.showMessageBox(win, arg.options).then((data) => {
        e.reply(arg.reply, { 'arg': arg, 'index': data.response })
    })
})

ipcMain.on('pop', (e, arg) => {
    tray.popUpContextMenu(form)
})

ipcMain.on('getTimeOffset', (e, arg) => {
    prompt({
        title: '计时矫正',
        label: '请设置课表计时与系统时间的偏移秒数:',
        value: arg.toString(),
        inputAttrs: {
            type: 'number'
        },
        type: 'input',
        height: 180,
        width: 400,
        icon: basePath + 'image/clock.png',
    }).then((r) => {
        if (r === null) {
            console.log('[getTimeOffset] User cancelled');
        } else {
            win.webContents.send('setTimeOffset', Number(r) % 10000000000000)
        }
    })
})

ipcMain.on('resetSetup', () => {
    store.set('isAutoLaunch', false);
    setAutoLaunch();
    app.quit();
})