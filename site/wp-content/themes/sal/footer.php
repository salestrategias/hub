<?php
/**
 * Rodapé: contato, navegação e assinatura da marca.
 *
 * @package sal
 */

$sal_zap = sal_whatsapp_url();
?>

<footer class="rodape">
	<div class="wrap">
		<div class="rodape__grid">
			<div>
				<?php sal_logo(); ?>
				<p class="rodape__assinatura"><?php esc_html_e( 'Marketing na Medida Certa', 'sal' ); ?></p>
				<p style="color:rgba(248,246,242,.6);max-width:26rem;">
					<?php esc_html_e( 'Agência de marketing para e-commerce e varejo local.', 'sal' ); ?>
				</p>
			</div>

			<nav aria-label="<?php esc_attr_e( 'Menu do rodapé', 'sal' ); ?>">
				<h4><?php esc_html_e( 'Navegue', 'sal' ); ?></h4>
				<?php
				wp_nav_menu( array(
					'theme_location' => 'rodape',
					'container'      => false,
					'depth'          => 1,
					'fallback_cb'    => 'sal_menu_padrao',
				) );
				?>
			</nav>

			<div>
				<h4><?php esc_html_e( 'Fale com a gente', 'sal' ); ?></h4>
				<ul>
					<?php $sal_email = sal_mod( 'sal_email' ); ?>
					<?php if ( $sal_email ) : ?>
						<li><a href="mailto:<?php echo esc_attr( $sal_email ); ?>"><?php echo esc_html( $sal_email ); ?></a></li>
					<?php endif; ?>
					<?php if ( $sal_zap ) : ?>
						<li><a href="<?php echo esc_url( $sal_zap ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'WhatsApp', 'sal' ); ?></a></li>
					<?php endif; ?>
					<?php $sal_ig = sal_mod( 'sal_instagram' ); ?>
					<?php if ( $sal_ig ) : ?>
						<li><a href="<?php echo esc_url( $sal_ig ); ?>" target="_blank" rel="noopener">Instagram</a></li>
					<?php endif; ?>
					<?php $sal_in = sal_mod( 'sal_linkedin' ); ?>
					<?php if ( $sal_in ) : ?>
						<li><a href="<?php echo esc_url( $sal_in ); ?>" target="_blank" rel="noopener">LinkedIn</a></li>
					<?php endif; ?>
				</ul>
			</div>
		</div>

		<div class="rodape__legal">
			<span>© <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?>. <?php esc_html_e( 'Todos os direitos reservados.', 'sal' ); ?></span>
			<a href="<?php echo esc_url( home_url( '/politica-de-privacidade/' ) ); ?>"><?php esc_html_e( 'Política de privacidade', 'sal' ); ?></a>
		</div>
	</div>
</footer>

<?php if ( $sal_zap ) : ?>
	<a class="zap-flutuante" href="<?php echo esc_url( $sal_zap ); ?>" target="_blank" rel="noopener" aria-label="<?php esc_attr_e( 'Conversar no WhatsApp', 'sal' ); ?>">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07a8.18 8.18 0 0 1-2.4-1.49 9 9 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.11.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.58-.34ZM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 1 1 8.38 4.63Zm8.4-18.3A11.82 11.82 0 0 0 12.04 0C5.5 0 .19 5.32.18 11.86c0 2.09.55 4.13 1.58 5.93L.08 24l6.35-1.66a11.85 11.85 0 0 0 5.61 1.43h.01c6.54 0 11.86-5.32 11.86-11.86 0-3.17-1.23-6.15-3.47-8.39Z"/></svg>
		<span><?php esc_html_e( 'Falar no WhatsApp', 'sal' ); ?></span>
	</a>
<?php endif; ?>

<?php wp_footer(); ?>
</body>
</html>
