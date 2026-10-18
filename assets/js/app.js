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
        loadComponent("#footer-el", "../../test/el/components/footer.html")
    ]);
}

init().catch(console.error);

