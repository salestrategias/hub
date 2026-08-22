<?php
/**
 * Resultados de busca, no desenho do blog.
 *
 * @package sal
 */

get_header( 'blog' );
?>

<main id="conteudo">

	<section class="sb-arquivo-cabeca">
		<div class="sb-wrap">
			<a class="sb-volta" href="<?php echo esc_url( home_url( '/blog/' ) ); ?>"><?php esc_html_e( '← Voltar ao portal', 'sal' ); ?></a>
			<div class="sb-olho">
				<span class="sb-cat"><?php esc_html_e( 'Busca', 'sal' ); ?></span>
				<span class="sb-grao" aria-hidden="true"></span>
			</div>
			<h1>
				<?php
				/* translators: %s: termo buscado. */
				printf( esc_html__( 'Resultados para “%s”', 'sal' ), esc_html( get_search_query() ) );
				?>
			</h1>
			<?php if ( have_posts() ) : global $wp_query; ?>
				<p class="sb-conta">
					<?php
					printf(
						/* translators: %s: total de resultados */
						esc_html( _n( '%s resultado', '%s resultados', (int) $wp_query->found_posts, 'sal' ) ),
						esc_html( number_format_i18n( (int) $wp_query->found_posts ) )
					);
					?>
				</p>
			<?php endif; ?>
		</div>
	</section>

	<section class="sb-sec">
		<div class="sb-wrap">
			<?php if ( have_posts() ) : ?>
				<h2 class="sb-rotulo"><?php esc_html_e( 'Artigos encontrados', 'sal' ); ?></h2>
				<div class="sb-cards">
					<?php
					while ( have_posts() ) {
						the_post();
						sal_blog_card( get_post() );
					}
					?>
				</div>
				<nav class="sb-paginas" aria-label="<?php esc_attr_e( 'Páginas de resultados', 'sal' ); ?>">
					<?php
					echo paginate_links( array(
						'prev_text' => '←',
						'next_text' => '→',
					) );
					?>
				</nav>
			<?php else : ?>
				<p><?php esc_html_e( 'Não achamos nada com esse termo. Tente outra palavra, ou chame no WhatsApp que respondemos.', 'sal' ); ?></p>
			<?php endif; ?>
		</div>
	</section>

</main>

<?php get_footer( 'blog' ); ?>
