<?php
/** Rodapé no padrão do site, mais a barra de cookies (mesma escolha do site). */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>

<section class="band">
	<div class="wrap">
		<h2>Vamos agendar uma reunião e analisar a sua operação?</h2>
		<p class="band-sub">Escolha um horário e analisamos as suas contas de anúncio, a sua presença no mapa e a sua concorrência. Você sai com as prioridades na mão.</p>
		<a class="btn btn-primary" href="<?php echo esc_url( SAL_AGENDA ); ?>">Agendar diagnóstico ↗</a>
	</div>
</section>

<footer class="rodape">
	<div class="wrap">
		<div class="rodape-grade">
			<div>
				<img src="/img/logo-sal-branco.svg" alt="SAL Estratégias de Marketing" width="72" height="41">
				<p>Assessoria de Tráfego Pago e SEO para lojas físicas e e-commerces. Fazemos marketing na medida certa para você vender mais e crescer de forma sustentável.</p>
			</div>
			<nav aria-label="Serviços">
				<h3>Serviços</h3>
				<a href="/seo-local/">SEO local</a>
				<a href="/seo-para-ecommerce/">SEO para e-commerce</a>
				<a href="/trafego-pago/">Tráfego pago</a>
				<a href="/diagnostico-de-site/">Diagnóstico de site</a>
			</nav>
			<nav aria-label="Navegar">
				<h3>Navegar</h3>
				<a href="/">Site da SAL</a>
				<a href="/quem-somos/">Quem somos</a>
				<a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">Blog</a>
				<a href="/politica-de-privacidade/">Política de privacidade</a>
			</nav>
			<nav aria-label="Editorias">
				<h3>Editorias</h3>
				<?php foreach ( array_slice( sal_editorias(), 0, 5 ) as $ed ) : ?>
					<a href="<?php echo esc_url( get_category_link( $ed ) ); ?>"><?php echo esc_html( $ed->name ); ?></a>
				<?php endforeach; ?>
			</nav>
		</div>
		<div class="rodape-legal">
			<span>SAL ESTRATÉGIAS DE MARKETING LTDA · CNPJ 66.018.951/0001-04 · Porto Alegre, RS</span>
			<span>Atendimento 100% online · <a href="<?php echo esc_url( SAL_ZAP ); ?>" rel="noopener">(51) 99338-0278</a> · <a href="mailto:contato@salestrategias.com.br">contato@salestrategias.com.br</a></span>
		</div>
	</div>
</footer>

<div class="cookies" id="cookies" hidden>
	<p>Este site usa cookies para funcionar e, se você deixar, para medir o desempenho das páginas. Você escolhe. <a href="/politica-de-privacidade/">Ler a política de privacidade</a>.</p>
	<div>
		<button type="button" class="btn btn-ghost" data-cookies="recusar">Só os necessários</button>
		<button type="button" class="btn btn-primary" data-cookies="aceitar">Aceitar todos</button>
	</div>
</div>

<?php wp_footer(); ?>
</body>
</html>
