/**
 * ponytail: IntersectionObserver全局单例，实现Scroll Entry Animations
 * 一行写完简单逻辑：观察所有.section-content元素，进入视口后添加.visible类
 * 避免scroll listener引起的reflow，性能友好
 */
export const useScrollEntry = () => {
  // ponytail: 使用IntersectionObserver而非scroll listener（避免reflow）
  // 简化版：全局一次性初始化，threshold 0.1，rootMargin -10%
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target); // 只触发一次
      }
    }),
    { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
  );

  // ponytail: 一行观察所有.section-content
  document.querySelectorAll('.section-content').forEach(el => observer.observe(el));
}