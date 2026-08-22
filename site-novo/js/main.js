// SAL — JS mínimo, conforme regras de movimento do design system:
// fade + 8px no scroll-in, nada de bounce, nada de parallax.
(function () {
	'use strict';

	var btn = document.querySelector('.menu-btn');
	var menu = document.getElementById('menu');
	if (btn && menu) {
		btn.addEventListener('click', function () {
			var aberto = menu.classList.toggle('aberto');
			btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
		});
	}

	// Grifo lima: desenha da esquerda quando entra no viewport (uma vez).
	var grifos = document.querySelectorAll('.grifo');
	if ('IntersectionObserver' in window) {
		var ig = new IntersectionObserver(function (es) {
			es.forEach(function (e) {
				if (e.isIntersecting) { e.target.classList.add('grifado'); ig.unobserve(e.target); }
			});
		}, { threshold: 0.9 });
		grifos.forEach(function (el) { ig.observe(el); });
	} else {
		grifos.forEach(function (el) { el.classList.add('grifado'); });
	}

	// Dosador: barras crescem quando o painel entra na tela.
	var dosador = document.querySelector('.dosador');
	if (dosador && 'IntersectionObserver' in window) {
		var id = new IntersectionObserver(function (es) {
			es.forEach(function (e) {
				if (e.isIntersecting) { e.target.classList.add('medido'); id.unobserve(e.target); }
			});
		}, { threshold: 0.35 });
		id.observe(dosador);
	} else if (dosador) {
		dosador.classList.add('medido');
	}

	var alvos = document.querySelectorAll('.revela');
	if ('IntersectionObserver' in window) {
		var io = new IntersectionObserver(function (es) {
			es.forEach(function (e) {
				if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); }
			});
		}, { rootMargin: '0px 0px -10% 0px' });
		alvos.forEach(function (el) { io.observe(el); });
	} else {
		alvos.forEach(function (el) { el.classList.add('visto'); });
	}
})();
