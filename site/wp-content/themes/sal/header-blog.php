<?php
/**
 * Cabeçalho das telas do blog: barra alta com a assinatura, topo escuro com
 * as editorias, busca e o CTA da agenda.
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
<body <?php body_class( 'sb-tela' ); ?>>
<?php wp_body_open(); ?>

<a class="pular-link" href="#conteudo"><?php esc_html_e( 'Pular para o conteúdo', 'sal' ); ?></a>

<div class="sb-alto">
	<div class="sb-wrap">
		<span class="sb-data"><?php echo esc_html( date_i18n( 'l, j \d\e F \d\e Y' ) ); ?></span>
		<span><span class="sb-grao" aria-hidden="true"></span> <b>Marketing na Medida Certa</b></span>
		<?php if ( function_exists( 'sal_whatsapp_url' ) && sal_whatsapp_url() ) : ?>
			<a href="<?php echo esc_url( sal_whatsapp_url() ); ?>" rel="noopener"><b>WhatsApp</b> <?php echo esc_html( sal_mod( 'sal_whatsapp' ) ); ?></a>
		<?php endif; ?>
	</div>
</div>

<header class="sb-topo">
	<div class="sb-wrap">
		<a class="sb-logo" href="<?php echo esc_url( home_url( '/blog/' ) ); ?>" aria-label="<?php esc_attr_e( 'Blog da SAL', 'sal' ); ?>">
			<img src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/sal-logo-branco.svg' ); ?>" alt="SAL Estratégias de Marketing" width="104" height="59">
		</a>

		<nav aria-label="<?php esc_attr_e( 'Editorias', 'sal' ); ?>">
			<?php // as quatro maiores; as demais aparecem no portal e no rodapé ?>
			<?php foreach ( array_slice( sal_blog_editorias(), 0, 4 ) as $ed ) : ?>
				<a href="<?php echo esc_url( get_category_link( $ed ) ); ?>"<?php echo ( is_category( $ed->term_id ) ? ' aria-current="page"' : '' ); ?>><?php echo esc_html( $ed->name ); ?></a>
			<?php endforeach; ?>
		</nav>

		<div class="sb-topo-fim">
			<form class="sb-busca-form" role="search" method="get" action="<?php echo esc_url( home_url( '/' ) ); ?>">
				<label class="screen-reader-text" for="sb-busca"><?php esc_html_e( 'Buscar no blog', 'sal' ); ?></label>
				<input type="search" id="sb-busca" name="s" placeholder="<?php esc_attr_e( 'Buscar artigo…', 'sal' ); ?>" value="<?php echo esc_attr( get_search_query() ); ?>">
			</form>
			<a class="sb-cta" href="<?php echo esc_url( sal_blog_cta_url() ); ?>"><?php esc_html_e( 'Agendar diagnóstico', 'sal' ); ?></a>
		</div>
	</div>
</header>
