document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileMenu();
  initActiveLinks();
  initContactForm();
  
  // Interactive Widgets
  initHeroField();
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

