<?php
/**
 * Template Name: Página de serviço (LP)
 * Template Post Type: page
 *
 * Landing page de serviço: breadcrumbs + conteúdo extenso do editor
 * (com [sal_faq], [sal_cta], [sal_newsletter]) + CTA final + schema Service.
 * O texto vive no editor; o template cuida da estrutura e do schema.
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo">
	<?php while ( have_posts() ) : ?>
		<?php the_post(); ?>
		<article <?php post_class(); ?>>
			<header class="pagina__cabeca wrap">
				<?php sal_breadcrumbs( array( __( 'Serviços', 'sal' ) => home_url( '/servicos/' ) ) ); ?>
				<h1><?php the_title(); ?></h1>
				<?php if ( has_excerpt() ) : ?>
					<p class="pagina__sub"><?php echo esc_html( get_the_excerpt() ); ?></p>
				<?php endif; ?>
			</header>

			<div class="conteudo wrap">
				<?php the_content(); ?>
			</div>

			<footer class="artigo__rodape wrap">
				<div class="artigo-cta">
					<h2><?php echo esc_html( sal_mod( 'sal_final_titulo' ) ); ?></h2>
					<p><?php echo esc_html( sal_mod( 'sal_final_texto' ) ); ?></p>
					<a class="btn btn--claro" href="<?php echo esc_url( sal_cta_url() ); ?>"><?php echo esc_html( sal_mod( 'sal_cta_texto' ) ); ?> <span class="seta" aria-hidden="true">→</span></a>
				</div>
			</footer>
		</article>

		<?php
		// Schema Service: nome = título da página; descrição = excerpt.
		$sal_schema = array(
			'@context'    => 'https://schema.org',
			'@type'       => 'Service',
			'name'        => get_the_title(),
			'url'         => get_permalink(),
			'areaServed'  => 'BR',
			'provider'    => array(
				'@type' => 'Organization',
				'name'  => get_bloginfo( 'name' ),
				'url'   => home_url( '/' ),
			),
		);
		if ( has_excerpt() ) {
			$sal_schema['description'] = wp_strip_all_tags( get_the_excerpt() );
		}
		echo '<script type="application/ld+json">' . wp_json_encode( $sal_schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
		?>
	<?php endwhile; ?>
</main>

<?php
get_footer();
