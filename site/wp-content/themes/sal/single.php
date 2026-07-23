<?php
/**
 * Artigo do blog: largura de leitura confortável + CTA de diagnóstico no fim.
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo">
	<?php while ( have_posts() ) : ?>
		<?php the_post(); ?>

		<article <?php post_class(); ?>>
			<header class="artigo__cabeca wrap">
				<?php
				$sal_categoria = get_the_category();
				if ( $sal_categoria ) {
					echo '<a class="tag" href="' . esc_url( get_category_link( $sal_categoria[0] ) ) . '">' . esc_html( $sal_categoria[0]->name ) . '</a>';
				}
				?>
				<h1><?php the_title(); ?></h1>
				<div class="artigo__meta">
					<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time>
					<?php if ( get_the_modified_date( 'Ymd' ) !== get_the_date( 'Ymd' ) ) : ?>
						<span><?php esc_html_e( 'Atualizado em', 'sal' ); ?> <?php echo esc_html( get_the_modified_date() ); ?></span>
					<?php endif; ?>
				</div>
			</header>

			<?php if ( has_post_thumbnail() ) : ?>
				<figure class="artigo__capa wrap">
					<?php the_post_thumbnail( 'large', array( 'fetchpriority' => 'high' ) ); ?>
				</figure>
			<?php endif; ?>

			<div class="conteudo wrap">
				<?php the_content(); ?>
			</div>

			<footer class="artigo__rodape wrap">
				<?php the_tags( '<div class="artigo__tags">', '', '</div>' ); ?>

				<div class="artigo-cta">
					<h2><?php esc_html_e( 'Quer aplicar isso na sua loja?', 'sal' ); ?></h2>
					<p><?php esc_html_e( 'Peça o Diagnóstico SAL: a gente analisa seus canais e seus números e devolve um parecer com prioridades, sem compromisso.', 'sal' ); ?></p>
					<a class="btn btn--claro" href="<?php echo esc_url( sal_cta_url() ); ?>"><?php echo esc_html( sal_mod( 'sal_cta_texto' ) ); ?> <span class="seta" aria-hidden="true">→</span></a>
				</div>

				<nav class="artigo__nav" aria-label="<?php esc_attr_e( 'Outros artigos', 'sal' ); ?>">
					<div class="anterior">
						<?php
						$sal_anterior = get_previous_post();
						if ( $sal_anterior ) {
							echo '<a href="' . esc_url( get_permalink( $sal_anterior ) ) . '"><small>' . esc_html__( '← Anterior', 'sal' ) . '</small>' . esc_html( get_the_title( $sal_anterior ) ) . '</a>';
						}
						?>
					</div>
					<div class="proximo">
						<?php
						$sal_proximo = get_next_post();
						if ( $sal_proximo ) {
							echo '<a href="' . esc_url( get_permalink( $sal_proximo ) ) . '"><small>' . esc_html__( 'Próximo →', 'sal' ) . '</small>' . esc_html( get_the_title( $sal_proximo ) ) . '</a>';
						}
						?>
					</div>
				</nav>
			</footer>
		</article>

		<?php
		if ( comments_open() || get_comments_number() ) {
			comments_template();
		}
		?>
	<?php endwhile; ?>
</main>

<?php
get_footer();
