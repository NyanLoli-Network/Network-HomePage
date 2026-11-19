import { type ThemeDefinition } from 'vuetify'

// 与 main.scss 中的设计 token 保持一致
export const lightTheme: ThemeDefinition = {
    dark: false,
    colors: {
        background: '#F2F1EC',
        surface: '#F2F1EC',
        primary: '#D42A62',
        secondary: '#121212',
        error: '#D42A62'
    }
}

export const darkTheme: ThemeDefinition = {
    dark: true,
    colors: {
        background: '#07080A',
        surface: '#0F1114',
        primary: '#FF6B9A',
        secondary: '#EDEBE6',
        error: '#FF6B9A'
    }
}
