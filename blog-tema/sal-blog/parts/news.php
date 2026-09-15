<?php
/** Assinatura da newsletter (Substack). Usada no portal e no fim de cada artigo. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<section class="news">
	<div class="wrap news-grade">
		<div>
			<h2>O varejo muda toda semana. Resumimos pra você.</h2>
			<p>Receba o essencial de tráfego, SEO e e-commerce, na medida certa. Sem spam, sem enrolação.</p>
		</div>
		<form action="<?php echo esc_url( SAL_SUBSTACK ); ?>" method="get" target="_blank" rel="noopener">
			<input type="hidden" name="utm_source" value="blog-sal">
			<label class="oculto" for="news-email-<?php echo (int) get_the_ID(); ?>">Seu e-mail</label>
			<input id="news-email-<?php echo (int) get_the_ID(); ?>" type="email" name="email" placeholder="voce@suaempresa.com.br" required>
			<button class="btn btn-primary" type="submit">Quero receber →</button>
		</form>
	</div>
</section>
