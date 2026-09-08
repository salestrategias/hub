<?php
/**
 * Rodapé das telas do blog: escuro, com a marca, os caminhos e a linha legal.
 *
 * @package sal
 */
?>
<footer class="sb-rodape">
	<div class="sb-wrap">
		<div class="sb-grade">
			<div class="sb-marca">
				<img src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/sal-logo-branco.svg' ); ?>" alt="SAL Estratégias de Marketing" width="96" height="54" loading="lazy">
				<p><?php esc_html_e( 'Assessoria de Tráfego Pago e SEO para lojas físicas e e-commerces. Fazemos marketing na medida certa para você vender mais e crescer de forma sustentável.', 'sal' ); ?></p>
			</div>
			<div>
				<p class="sb-rodape-tit"><?php esc_html_e( 'Editorias', 'sal' ); ?></p>
				<ul>
					<?php foreach ( sal_blog_editorias() as $ed ) : ?>
						<li><a href="<?php echo esc_url( get_category_link( $ed ) ); ?>"><?php echo esc_html( $ed->name ); ?></a></li>
					<?php endforeach; ?>
				</ul>
			</div>
			<div>
				<p class="sb-rodape-tit"><?php esc_html_e( 'Navegar', 'sal' ); ?></p>
				<ul>
					<li><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Site da SAL', 'sal' ); ?></a></li>
					<li><a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>"><?php esc_html_e( 'Blog', 'sal' ); ?></a></li>
					<li><a href="<?php echo esc_url( sal_blog_cta_url() ); ?>"><?php esc_html_e( 'Agendar diagnóstico', 'sal' ); ?></a></li>
					<li><a href="<?php echo esc_url( home_url( '/politica-de-privacidade/' ) ); ?>"><?php esc_html_e( 'Política de privacidade', 'sal' ); ?></a></li>
				</ul>
			</div>
			<div>
				<p class="sb-rodape-tit"><?php esc_html_e( 'Contato', 'sal' ); ?></p>
				<ul>
					<?php if ( function_exists( 'sal_whatsapp_url' ) && sal_whatsapp_url() ) : ?>
						<li><a href="<?php echo esc_url( sal_whatsapp_url() ); ?>" rel="noopener">WhatsApp</a></li>
					<?php endif; ?>
					<li><a href="https://www.instagram.com/salestrategias/" rel="noopener">Instagram</a></li>
					<li><a href="https://www.linkedin.com/in/mcfreitas/" rel="noopener">LinkedIn</a></li>
					<li><a href="https://marcelofreitas.substack.com/" rel="noopener">Newsletter</a></li>
				</ul>
			</div>
		</div>
		<div class="sb-base">
			<span>SAL ESTRATÉGIAS DE MARKETING LTDA · CNPJ 66.018.951/0001-04 · Porto Alegre, RS</span>
			<span><?php esc_html_e( 'Atendimento 100% online, para o Brasil todo.', 'sal' ); ?></span>
		</div>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
