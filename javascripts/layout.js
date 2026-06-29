// Shared layout components for Paulo Tanaka's website

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inject Header
  const headerContainer = document.getElementById('shared-header');
  if (headerContainer) {
    const depth = parseInt(headerContainer.getAttribute('data-depth') || (headerContainer.getAttribute('data-subpage') === 'true' ? '1' : '0'), 10);
    const basePath = '../'.repeat(depth);
    const activeLink = headerContainer.getAttribute('data-active');
    
    headerContainer.innerHTML = `
      <div class="nav-container">
        <a href="${basePath}index.html" class="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
          </svg>
          <span>PAULO TANAKA</span>
        </a>
        <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Toggle Menu" aria-expanded="false">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <ul class="nav-links">
          <li><a href="${basePath}index.html" class="${activeLink === 'home' ? 'active' : ''}">Home</a></li>
          <li><a href="${basePath}index.html#essays" class="${activeLink === 'essays' ? 'active' : ''}">Essays</a></li>
          <li><a href="${basePath}index.html#playground" class="${activeLink === 'playground' ? 'active' : ''}">Playground</a></li>
        </ul>
      </div>
    `;
    
    // Initialize mobile menu toggle
    const toggle = document.getElementById('mobile-menu-toggle');
    const navLinks = headerContainer.querySelector('.nav-links');
    if (toggle && navLinks) {
      toggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !expanded);
      });
    }
  }

  // 2. Inject Footer
  const footerContainer = document.getElementById('shared-footer');
  if (footerContainer) {
    footerContainer.innerHTML = `
      <div class="footer-wrapper">
        <span class="footer-logo">PAULO TANAKA</span>
        <p>&copy; 2026 Paulo Tanaka. All rights reserved.</p>
        <ul class="footer-socials">
          <li><a href="https://github.com/paulot" target="_blank" rel="noopener noreferrer">Github</a></li>
          <li><a href="https://linkedin.com/in/paulotanaka" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
        </ul>
      </div>
    `;
  }
});
