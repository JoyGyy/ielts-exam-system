const FLAG_KEY = '__ielts_test_env__';
const LOCATION_HINTS = ['test_env=1', 'ci=1'];

const readStorageFlag = () => {
    try {
        if (window.localStorage) {
            return window.localStorage.getItem(FLAG_KEY) === 'true';
        }
    } catch (error) {
        console.warn('[EnvDetector] 无法读取测试标记:', error);
    }
    return false;
};

const persistFlag = (value) => {
    try {
        if (window.localStorage) {
            if (value) {
                window.localStorage.setItem(FLAG_KEY, 'true');
            } else {
                window.localStorage.removeItem(FLAG_KEY);
            }
        }
    } catch (error) {
        console.warn('[EnvDetector] 无法写入测试标记:', error);
    }
};

const shouldActivateFromLocation = () => {
    if (!window.location) {
        return false;
    }
    const search = (window.location.search || '').toLowerCase();
    const hash = (window.location.hash || '').toLowerCase();
    return LOCATION_HINTS.some((hint) => search.includes(hint) || hash.includes(hint));
};

const environmentDetector = {
    isInTestEnvironment() {
        if (window.__IELTS_FORCE_TEST_ENV__ === true) {
            return true;
        }

        if (shouldActivateFromLocation()) {
            this.enableTestEnvironment({ persist: true });
            return true;
        }

        if (readStorageFlag()) {
            window.__IELTS_FORCE_TEST_ENV__ = true;
            return true;
        }

        const userAgent = (window.navigator && window.navigator.userAgent) || '';
        if (/\b(playwright|puppeteer|headlesschrome)\b/i.test(userAgent)) {
            return true;
        }

        return false;
    },

    enableTestEnvironment(options = {}) {
        window.__IELTS_FORCE_TEST_ENV__ = true;
        if (options.persist !== false) {
            persistFlag(true);
        }
    },

    disableTestEnvironment() {
        window.__IELTS_FORCE_TEST_ENV__ = false;
        persistFlag(false);
    }
};

export default environmentDetector;

if (typeof window !== 'undefined') {
    window.EnvironmentDetector = environmentDetector;
}
