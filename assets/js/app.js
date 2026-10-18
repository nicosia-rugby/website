async function loadComponent(selector, file) {
    const element = document.querySelector(selector);

    if (!element) {
        throw new Error(`Element not found: ${selector}`);
    }

    const response = await fetch(file);

    if (!response.ok) {
        throw new Error(`Failed to load ${file}`);
    }

    element.innerHTML = await response.text();
}

async function init() {
    await Promise.all([
        loadComponent("#calendar-fixtures", "/test/components/calendar_fixtures.html"),
        loadComponent("#header-el", "/test/el/components/header.html"),
        loadComponent("#footer-el", "/test/el/components/footer.html"),
        loadComponent("#contact-el", "/test/el/components/contact.html"),
        loadComponent("#sponsors-el", "/test/el/components/sponsors.html")
    ]);
}

init().catch(console.error);

