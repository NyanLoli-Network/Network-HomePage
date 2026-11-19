import { computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'

const STORAGE_KEY = 'themePreference'
type ThemeName = 'lightTheme' | 'darkTheme'

function readPreference(): ThemeName | null {
    try {
        const v = localStorage.getItem(STORAGE_KEY)
        return v === 'lightTheme' || v === 'darkTheme' ? v : null
    } catch {
        return null
    }
}

function systemTheme(): ThemeName {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'darkTheme' : 'lightTheme'
}

/** 在 Vuetify 创建前决定初始主题，避免首屏闪烁 */
export function initialThemeName(): ThemeName {
    return readPreference() ?? systemTheme()
}

function syncDocument(name: ThemeName) {
    const dark = name === 'darkTheme'
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    document.documentElement.style.backgroundColor = dark ? '#07080a' : '#f2f1ec'
}

export function useColorMode() {
    const theme = useTheme()
    const isDark = computed(() => theme.global.current.value.dark)

    const apply = (name: ThemeName) => {
        theme.global.name.value = name
        syncDocument(name)
    }

    const toggle = () => {
        const next: ThemeName = isDark.value ? 'lightTheme' : 'darkTheme'
        apply(next)
        try {
            localStorage.setItem(STORAGE_KEY, next)
        } catch {
            /* 隐私模式等情况下忽略 */
        }
    }

    // 用户未手动选择时，跟随系统变化
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = (e: MediaQueryListEvent) => {
        if (!readPreference()) apply(e.matches ? 'darkTheme' : 'lightTheme')
    }

    onMounted(() => {
        syncDocument(theme.global.name.value as ThemeName)
        media.addEventListener('change', onSystemChange)
    })
    onUnmounted(() => media.removeEventListener('change', onSystemChange))

    return { isDark, toggle }
}
