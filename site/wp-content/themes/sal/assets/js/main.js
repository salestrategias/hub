/**
 * SAL — JS do tema. Vanilla, ~1.5 KB, carregado com defer.
 * 1. Menu mobile   2. Sombra no header ao rolar   3. Revelação no scroll
 */
(function () {
	'use strict';

	// 1 · Menu mobile
	var botao = document.querySelector('.menu-botao');
	var menu = document.getElementById('menu-site');
	if (botao && menu) {
		botao.addEventListener('click', function () {
			var aberto = menu.classList.toggle('aberto');
			botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
		});
		// Fecha ao navegar por âncora (senão o menu cobre a seção destino).
		menu.addEventListener('click', function (e) {
			if (e.target.closest('a')) {
				menu.classList.remove('aberto');
				botao.setAttribute('aria-expanded', 'false');
			}
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && menu.classList.contains('aberto')) {
				menu.classList.remove('aberto');
				botao.setAttribute('aria-expanded', 'false');
				botao.focus();
			}
		});
	}

	// 2 · Sombra no header depois que a página rola
	var topo = document.getElementById('topo');
	if (topo) {
		var marcar = function () {
			topo.classList.toggle('rolou', window.scrollY > 8);
		};
		window.addEventListener('scroll', marcar, { passive: true });
		marcar();
	}

	// 3 · Revelação suave das seções (respeita prefers-reduced-motion via CSS)
	var alvos = document.querySelectorAll('.revela');
	if (alvos.length && 'IntersectionObserver' in window) {
		var io = new IntersectionObserver(function (entradas) {
			entradas.forEach(function (entrada) {
				if (entrada.isIntersecting) {
					entrada.target.classList.add('visivel');
					io.unobserve(entrada.target);
				}
			});
		}, { rootMargin: '0px 0px -8% 0px' });
		alvos.forEach(function (el) { io.observe(el); });
	} else {
		alvos.forEach(function (el) { el.classList.add('visivel'); });
	}
})();
