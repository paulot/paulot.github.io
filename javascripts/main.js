document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileMenu();
  initActiveLinks();
  initContactForm();
  
  // Interactive Widgets
  initHeroField();
  initMcmcWidget();
});

/* Header Scrolled State */
function initHeader() {
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

/* Mobile Menu Toggle */
function initMobileMenu() {
  const toggle = document.getElementById('mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !expanded);
    });
  }
}

/* Active Nav Links on Scroll */
function initActiveLinks() {
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-links a');
  
  const options = {
    threshold: 0.3,
    rootMargin: '0px 0px -20% 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, options);
  
  sections.forEach(section => observer.observe(section));
}

/* Contact Form Submission */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
      
      // Simulate API Call
      setTimeout(() => {
        // Create a floating success toast
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.background = '#10b981';
        toast.style.color = '#fff';
        toast.style.padding = '16px 24px';
        toast.style.borderRadius = '12px';
        toast.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
        toast.style.fontWeight = '600';
        toast.style.boxShadow = '0 10px 25px rgba(16, 185, 129, 0.3)';
        toast.style.zIndex = '1000';
        toast.style.transform = 'translateY(100px)';
        toast.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        toast.textContent = 'Message sent successfully!';
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.style.transform = 'translateY(0)';
        }, 100);
        
        // Reset form
        form.reset();
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        // Remove toast
        setTimeout(() => {
          toast.style.transform = 'translateY(150px)';
          setTimeout(() => toast.remove(), 300);
        }, 3000);
      }, 1000);
    });
  }
}

/* Tooltip Helper */
function createTooltip(container) {
  const tooltip = document.createElement('div');
  tooltip.className = 'widget-tooltip';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 0.15s ease-in-out';
  container.appendChild(tooltip);
  
  return {
    show: (text, x, y) => {
      tooltip.innerHTML = text;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      tooltip.style.opacity = '1';
    },
    hide: () => {
      tooltip.style.opacity = '0';
    }
  };
}

/* 1. Hero Section Interactive Particle Field */
function initHeroField() {
  const container = document.getElementById('hero-interactive-field');
  if (!container) return;
  
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  
  let width = (canvas.width = container.offsetWidth);
  let height = (canvas.height = container.offsetHeight);
  
  const particles = [];
  const maxParticles = 60;
  
  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.8;
      this.vy = (Math.random() - 0.5) * 0.8;
      this.radius = Math.random() * 2 + 1;
    }
    
    update() {
      this.x += this.vx;
      this.y += this.vy;
      
      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;
    }
    
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(37, 99, 235, 0.4)';
      ctx.fill();
    }
  }
  
  for (let i = 0; i < maxParticles; i++) {
    particles.push(new Particle());
  }
  
  let mouse = { x: null, y: null, radius: 120 };
  container.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  
  container.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });
  
  function animate() {
    ctx.clearRect(0, 0, width, height);
    
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    
    // Connect particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(37, 99, 235, ${0.15 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
      
      // Connect to mouse
      if (mouse.x !== null && mouse.y !== null) {
        const dx = particles[i].x - mouse.x;
        const dy = particles[i].y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < mouse.radius) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(37, 99, 235, ${0.25 * (1 - dist / mouse.radius)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    
    requestAnimationFrame(animate);
  }
  
  animate();
  
  window.addEventListener('resize', () => {
    if (container.offsetWidth) {
      width = canvas.width = container.offsetWidth;
      height = canvas.height = container.offsetHeight;
    }
  });
}






/* 2. MCMC Interactive Sampler Widget v3 */
function initMcmcWidget() {
  const canvas = document.getElementById('mcmc-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Target Probability Density Function (Double Gaussian peaks)
  const peak1 = { x: 45, y: 70, sigma: 22, amp: 1.0 }; // Peak 1 (Spain)
  const peak2 = { x: 115, y: 70, sigma: 18, amp: 0.8 }; // Peak 2 (Argentina)
  
  function getProbability(x, y) {
    const d1 = ((x - peak1.x) ** 2 + (y - peak1.y) ** 2) / (2 * peak1.sigma ** 2);
    const d2 = ((x - peak2.x) ** 2 + (y - peak2.y) ** 2) / (2 * peak2.sigma ** 2);
    return peak1.amp * Math.exp(-d1) + peak2.amp * Math.exp(-d2);
  }
  
  // Current sampler state
  let currentX = 80;
  let currentY = 70;
  let history = [];
  const maxHistory = 20;
  
  // Histogram bins (for x-axis distribution)
  const numBins = 32;
  const binWidth = width / numBins;
  const histogram = new Array(numBins).fill(0);
  let totalSamples = 0;
  
  // Proposal state
  let proposedX = null;
  let proposedY = null;
  let proposalStatus = null; // 'accepted' or 'rejected'
  let proposalFlashTimer = 0;
  
  // MCMC Loop parameters
  let lastStepTime = 0;
  const stepInterval = 160; // ms per MCMC step
  
  function mcmcStep() {
    // Propose a new state using a random walk
    const stepSize = 18;
    const dx = (Math.random() - 0.5) * 2 * stepSize;
    const dy = (Math.random() - 0.5) * 2 * stepSize;
    
    proposedX = Math.max(8, Math.min(width - 8, currentX + dx));
    proposedY = Math.max(8, Math.min(height - 40, currentY + dy)); // Keep in top portion
    
    const pCurrent = getProbability(currentX, currentY);
    const pProposed = getProbability(proposedX, proposedY);
    
    // Metropolis acceptance ratio
    const alpha = pCurrent === 0 ? 1.0 : Math.min(1.0, pProposed / pCurrent);
    
    if (Math.random() < alpha) {
      // Accept!
      currentX = proposedX;
      currentY = proposedY;
      history.push({ x: currentX, y: currentY });
      if (history.length > maxHistory) history.shift();
      proposalStatus = 'accepted';
      
      // Add to distribution
      const binIdx = Math.floor(currentX / binWidth);
      if (binIdx >= 0 && binIdx < numBins) {
        histogram[binIdx]++;
        totalSamples++;
      }
    } else {
      // Reject!
      proposalStatus = 'rejected';
    }
    
    proposalFlashTimer = 6; // Flash duration
  }
  
  // Draw the background probability density contours (faint and clean)
  function drawContours() {
    // Peak 1
    for (let r = 8; r < 55; r += 12) {
      ctx.beginPath();
      ctx.arc(peak1.x, peak1.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(37, 99, 235, ${0.12 * (1 - r / 55)})`; // Blue
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }
    
    // Peak 2
    for (let r = 8; r < 45; r += 12) {
      ctx.beginPath();
      ctx.arc(peak2.x, peak2.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${0.12 * (1 - r / 45)})`; // Purple
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }
  }
  
  // Draw the smooth distribution curve at the bottom
  function drawDistributionCurve() {
    const maxVal = Math.max(...histogram, 1);
    const maxCurveHeight = 30; // Max height in pixels
    const yBaseline = height - 2;
    
    ctx.beginPath();
    ctx.moveTo(0, yBaseline);
    
    // Create points for the curve
    const points = [];
    for (let i = 0; i < numBins; i++) {
      const h = (histogram[i] / maxVal) * maxCurveHeight;
      const x = i * binWidth + binWidth / 2;
      const y = yBaseline - h;
      points.push({ x, y });
    }
    
    // Draw smooth curve using quadratic curves
    ctx.lineTo(0, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(width, points[points.length - 1].y);
    ctx.lineTo(width, yBaseline);
    ctx.closePath();
    
    // Create beautiful template gradient (Blue -> Purple -> Pink)
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.25)');   // Blue (#3b82f6)
    gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.25)'); // Purple (#8b5cf6)
    gradient.addColorStop(1, 'rgba(236, 72, 153, 0.25)');   // Pink (#ec4899)
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw the top stroke line
    ctx.beginPath();
    ctx.moveTo(0, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(width, points[points.length - 1].y);
    
    const strokeGradient = ctx.createLinearGradient(0, 0, width, 0);
    strokeGradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
    strokeGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.6)');
    strokeGradient.addColorStop(1, 'rgba(236, 72, 153, 0.6)');
    
    ctx.strokeStyle = strokeGradient;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  
  // Main draw loop
  function draw(timestamp) {
    ctx.clearRect(0, 0, width, height);
    
    // 1. Draw static contours & live distribution curve
    drawContours();
    if (totalSamples > 0) {
      drawDistributionCurve();
    }
    
    // 2. Step the MCMC sampler
    if (timestamp - lastStepTime > stepInterval) {
      mcmcStep();
      lastStepTime = timestamp;
    }
    
    // 3. Draw History Trail
    if (history.length > 1) {
      ctx.beginPath();
      ctx.moveTo(history[0].x, history[0].y);
      for (let i = 1; i < history.length; i++) {
        ctx.lineTo(history[i].x, history[i].y);
      }
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1.0;
      ctx.stroke();
      
      // Draw small dots along the trail
      history.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 163, 184, ${0.08 + (idx / history.length) * 0.2})`;
        ctx.fill();
      });
    }
    
    // 4. Draw Proposal Flash
    if (proposalFlashTimer > 0 && proposedX !== null) {
      ctx.beginPath();
      ctx.arc(proposedX, proposedY, 6, 0, Math.PI * 2);
      if (proposalStatus === 'accepted') {
        ctx.strokeStyle = `rgba(52, 211, 153, ${proposalFlashTimer / 6})`; // Emerald
        ctx.fillStyle = `rgba(52, 211, 153, ${(proposalFlashTimer / 6) * 0.15})`;
      } else {
        ctx.strokeStyle = `rgba(248, 113, 113, ${proposalFlashTimer / 6})`; // Red
        ctx.fillStyle = `rgba(248, 113, 113, ${(proposalFlashTimer / 6) * 0.15})`;
      }
      ctx.lineWidth = 1.0;
      ctx.fill();
      ctx.stroke();
      
      proposalFlashTimer--;
    }
    
    // 5. Draw Current Sampler State
    // Pulsing outer ring
    const pulseRadius = 4.0 + Math.sin(timestamp / 100) * 1.2;
    ctx.beginPath();
    ctx.arc(currentX, currentY, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    
    // Inner solid dot
    ctx.beginPath();
    ctx.arc(currentX, currentY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#60a5fa'; // Blue 400
    ctx.shadowColor = '#2563eb';
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.shadowBlur = 0; // Reset
    
    requestAnimationFrame(draw);
  }
  
  // Handle click to reposition the chain (burn-in demonstration)
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    
    currentX = (e.clientX - rect.left) * scaleX;
    currentY = (e.clientY - rect.top) * scaleY;
    
    // Keep within the sampling area
    currentY = Math.min(height - 40, currentY);
    
    history = [{ x: currentX, y: currentY }];
    proposedX = null;
    proposedY = null;
    proposalStatus = null;
    proposalFlashTimer = 0;
  });
  
  // Start animation loop
  requestAnimationFrame(draw);
}
