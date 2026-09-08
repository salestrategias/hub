<?php
/**
 * Cabeçalho: header fixo com logo, menu e CTA.
 *
 * @package sal
 */
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<script>document.body.classList.add('js');</script>

<a class="pular-link" href="#conteudo"><?php esc_html_e( 'Pular para o conteúdo', 'sal' ); ?></a>

<header class="topo" id="topo">
	<div class="wrap topo__linha">
		<?php sal_logo(); ?>

		<button class="menu-botao" aria-expanded="false" aria-controls="menu-site">
			<?php esc_html_e( 'Menu', 'sal' ); ?>
		</button>

		<nav class="menu-principal" id="menu-site" aria-label="<?php esc_attr_e( 'Menu principal', 'sal' ); ?>">
			<?php
			wp_nav_menu( array(
				'theme_location' => 'principal',
				'container'      => false,
				'depth'          => 1,
				'fallback_cb'    => 'sal_menu_padrao',
			) );
			?>
			<a class="btn btn--solido btn--mini" href="<?php echo esc_url( sal_cta_url() ); ?>"><?php echo esc_html( sal_mod( 'sal_cta_texto' ) ); ?></a>
		</nav>
	</div>
</header>
