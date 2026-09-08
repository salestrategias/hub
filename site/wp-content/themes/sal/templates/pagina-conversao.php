<?php
/**
 * Template Name: Página de conversão (sem menu)
 * Template Post Type: page
 *
 * Para landing pages de campanha e para a página de diagnóstico:
 * sem menu e sem rodapé completo — só o conteúdo e uma saída discreta.
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

<header class="topo">
	<div class="wrap topo__linha">
		<?php sal_logo(); ?>
	</div>
</header>

<main id="conteudo">
	<?php while ( have_posts() ) : ?>
		<?php the_post(); ?>
		<article <?php post_class(); ?>>
			<header class="pagina__cabeca wrap">
				<h1><?php the_title(); ?></h1>
			</header>
			<div class="conteudo wrap">
				<?php the_content(); ?>
			</div>
		</article>
	<?php endwhile; ?>
</main>

<footer class="rodape">
	<div class="wrap rodape__legal">
		<span>© <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?> · <?php esc_html_e( 'Marketing na Medida Certa', 'sal' ); ?></span>
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'salestrategias.com.br', 'sal' ); ?></a>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
