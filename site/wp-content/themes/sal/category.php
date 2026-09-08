<?php
/**
 * Arquivo de editoria: /blog/<categoria>/, paginado de 12 em 12.
 *
 * @package sal
 */

$termo = get_queried_object();

get_header( 'blog' );
?>

<main id="conteudo">

	<section class="sb-arquivo-cabeca">
		<div class="sb-wrap">
			<a class="sb-volta" href="<?php echo esc_url( home_url( '/blog/' ) ); ?>"><?php esc_html_e( '← Voltar ao portal', 'sal' ); ?></a>
			<div class="sb-olho">
				<span class="sb-cat"><?php esc_html_e( 'Editoria', 'sal' ); ?></span>
				<span class="sb-grao" aria-hidden="true"></span>
			</div>
			<h1><?php single_term_title(); ?></h1>
			<p class="sb-conta">
				<?php
				printf(
					/* translators: %s: total de artigos */
					esc_html( _n( '%s artigo publicado', '%s artigos publicados', (int) $termo->count, 'sal' ) ),
					esc_html( number_format_i18n( (int) $termo->count ) )
				);
				?>
			</p>
			<?php if ( term_description() ) : ?>
				<div class="sb-desc"><?php echo wp_kses_post( term_description() ); ?></div>
			<?php endif; ?>
		</div>
	</section>

	<section class="sb-sec">
		<div class="sb-wrap">
			<h2 class="sb-rotulo"><?php esc_html_e( 'Todos os artigos', 'sal' ); ?></h2>
			<?php if ( have_posts() ) : ?>
				<div class="sb-cards">
					<?php
					while ( have_posts() ) {
						the_post();
						sal_blog_card( get_post() );
					}
					?>
				</div>
				<nav class="sb-paginas" aria-label="<?php esc_attr_e( 'Páginas da editoria', 'sal' ); ?>">
					<?php
					echo paginate_links( array(
						'prev_text' => '←',
						'next_text' => '→',
					) );
					?>
				</nav>
			<?php else : ?>
				<p><?php esc_html_e( 'Ainda não há artigos nesta editoria.', 'sal' ); ?></p>
			<?php endif; ?>
		</div>
	</section>

	<section class="sb-chamada">
		<div class="sb-wrap">
			<div class="sb-graos" aria-hidden="true"><span class="sb-grao"></span><span class="sb-grao"></span><span class="sb-grao"></span></div>
			<h2><?php echo wp_kses( __( 'Sua loja merece marketing <em>na medida certa</em>.', 'sal' ), array( 'em' => array() ) ); ?></h2>
			<p><?php esc_html_e( 'Diagnóstico sem custo · 30 minutos, online · direto com quem faz', 'sal' ); ?></p>
			<a class="sb-pill" href="<?php echo esc_url( sal_blog_cta_url() ); ?>"><?php esc_html_e( 'Agendar diagnóstico →', 'sal' ); ?></a>
		</div>
	</section>

</main>

<?php get_footer( 'blog' ); ?>
