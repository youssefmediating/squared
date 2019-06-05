import { UserSettingsAndroid } from './@types/application';

const settings: UserSettingsAndroid = {
    builtInExtensions: [
        'android.delegate.max-width-height',
        'android.delegate.fixed',
        'android.delegate.negative-x',
        'android.delegate.negative-viewport',
        'android.delegate.percent',
        'android.delegate.scrollbar',
        'android.delegate.radiogroup',
        'squared.external',
        'squared.substitute',
        'squared.sprite',
        'squared.css-grid',
        'squared.flexbox',
        'squared.table',
        'squared.list',
        'squared.grid',
        'squared.relative',
        'squared.verticalalign',
        'squared.whitespace',
        'squared.accessibility',
        'android.constraint.guideline',
        'android.resource.svg',
        'android.resource.background',
        'android.resource.strings',
        'android.resource.fonts',
        'android.resource.dimens',
        'android.resource.styles',
        'android.resource.includes'
    ],
    targetAPI: 28,
    resolutionDPI: 160,
    framesPerSecond: 60,
    supportRTL: true,
    preloadImages: true,
    supportNegativeLeftTop: true,
    exclusionsDisabled: false,
    customizationsOverwritePrivilege: true,
    showAttributes: true,
    createQuerySelectorMap: false,
    convertPixels: 'dp',
    insertSpaces: 4,
    handleExtensionsAsync: true,
    autoCloseOnWrite: true,
    showErrorMessages: true,
    manifestLabelAppName: 'android',
    manifestThemeName: 'AppTheme',
    manifestParentThemeName: 'Theme.AppCompat.Light.NoActionBar',
    outputDirectory: 'app/src/main',
    outputMainFileName: 'activity_main.xml',
    outputArchiveFormat: 'zip',
    outputArchiveTimeout: 30
};

export default settings;