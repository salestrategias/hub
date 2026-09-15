<?php
/**
 * Blog como portal de conteúdo:
 * manchete (post mais recente) + trilho de categorias + grade + newsletter.
 * Nas páginas 2+ a manchete some e vira grade direto.
 *
 * @package sal
 */

get_header();

$sal_pagina_atual = max( 1, (int) get_query_var( 'paged' ) );
?>

<main id="conteudo" class="secao">
	<div class="wrap">
		<header class="arquivo-cabeca secao__cabeca">
			<p class="kicker"><?php esc_html_e( 'Blog', 'sal' ); ?></p>
			<h1><?php echo esc_html( get_the_title( get_option( 'page_for_posts' ) ) ?: __( 'Portal SAL', 'sal' ) ); ?></h1>
			<p class="descricao"><?php esc_html_e( 'Guias e artigos sobre SEO, tráfego pago e gestão para quem tem loja, física ou virtual. Publicamos todos os dias.', 'sal' ); ?></p>
		</header>

		<?php
		// Trilho de categorias mais fortes do portal.
		$sal_cats = get_categories( array( 'orderby' => 'count', 'order' => 'DESC', 'number' => 7 ) );
		if ( $sal_cats ) :
			?>
			<nav class="trilho-cats" aria-label="<?php esc_attr_e( 'Categorias', 'sal' ); ?>">
				<?php foreach ( $sal_cats as $sal_cat ) : ?>
					<a class="tag" href="<?php echo esc_url( get_category_link( $sal_cat ) ); ?>"><?php echo esc_html( $sal_cat->name ); ?></a>
				<?php endforeach; ?>
			</nav>
		<?php endif; ?>

		<?php if ( have_posts() ) : ?>

			<?php if ( 1 === $sal_pagina_atual ) : ?>
				<?php
				the_post(); // Primeiro post vira a manchete.
				$sal_manchete_cat = get_the_category();
				?>
				<article class="manchete">
					<?php if ( has_post_thumbnail() ) : ?>
						<a class="manchete__capa" href="<?php the_permalink(); ?>" tabindex="-1" aria-hidden="true">
							<?php the_post_thumbnail( 'large', array( 'fetchpriority' => 'high' ) ); ?>
						</a>
					<?php endif; ?>
					<div class="manchete__corpo">
						<div class="card-post__meta">
							<?php if ( $sal_manchete_cat ) : ?>
								<span class="tag"><?php echo esc_html( $sal_manchete_cat[0]->name ); ?></span>
							<?php endif; ?>
							<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time>
						</div>
						<h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
						<p><?php echo esc_html( get_the_excerpt() ); ?></p>
						<p><a class="manchete__link" href="<?php the_permalink(); ?>"><?php esc_html_e( 'Ler o artigo', 'sal' ); ?> <span class="seta" aria-hidden="true">→</span></a></p>
					</div>
				</article>
			<?php endif; ?>

			<div class="arquivo-lista">
				<?php
				while ( have_posts() ) {
					the_post();
					sal_card_post();
				}
				?>
			</div>

			<?php sal_paginacao(); ?>

			<div class="secao-news">
				<?php echo sal_newsletter_form(); // phpcs:ignore WordPress.Security.EscapeOutput -- HTML montado com escaping interno. ?>
			</div>

		<?php else : ?>
			<div class="pagina-vazia">
				<p><?php esc_html_e( 'Nada publicado por aqui ainda.', 'sal' ); ?></p>
			</div>
		<?php endif; ?>
	</div>
</main>

<?php
get_footer();
