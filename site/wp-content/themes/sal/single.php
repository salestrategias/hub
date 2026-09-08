<?php
/**
 * Artigo do blog: trilha, título, capa grande, leitura confortável, autor,
 * CTA da agenda e três relacionados da mesma editoria.
 *
 * @package sal
 */

get_header( 'blog' );
?>

<main id="conteudo">
	<?php while ( have_posts() ) : ?>
		<?php the_post(); ?>
		<?php
		$sal_post = get_post();
		$sal_cat  = sal_blog_categoria( $sal_post );
		?>

		<article <?php post_class(); ?>>

			<header class="sb-artigo-cabeca">
				<div class="sb-wrap">
					<div class="sb-miolo">
						<nav class="sb-trilha" aria-label="<?php esc_attr_e( 'Você está em', 'sal' ); ?>">
							<a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>"><?php esc_html_e( 'Blog', 'sal' ); ?></a>
							<?php if ( $sal_cat ) : ?>
								<span aria-hidden="true">·</span>
								<a href="<?php echo esc_url( get_category_link( $sal_cat ) ); ?>"><?php echo esc_html( $sal_cat->name ); ?></a>
							<?php endif; ?>
						</nav>
						<?php if ( $sal_cat ) : ?><span class="sb-cat"><?php echo esc_html( $sal_cat->name ); ?></span><?php endif; ?>
						<h1><?php the_title(); ?></h1>
						<?php if ( has_excerpt() ) : ?>
							<p class="sb-dek"><?php echo esc_html( get_the_excerpt() ); ?></p>
						<?php endif; ?>
						<div class="sb-autor">
							<b>Marcelo Freitas</b>
							<span class="sb-grao" aria-hidden="true" style="width:5px;height:5px"></span>
							<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( sal_blog_data( $sal_post ) ); ?></time>
							<?php if ( get_the_modified_date( 'Ymd' ) !== get_the_date( 'Ymd' ) ) : ?>
								<span><?php esc_html_e( 'Atualizado em', 'sal' ); ?> <?php echo esc_html( get_the_modified_date( 'j/m/Y' ) ); ?></span>
							<?php endif; ?>
							<span class="sb-grao" aria-hidden="true" style="width:5px;height:5px"></span>
							<span>
								<?php
								printf(
									/* translators: %d: minutos de leitura */
									esc_html__( '%d min de leitura', 'sal' ),
									(int) sal_blog_leitura( $sal_post )
								);
								?>
							</span>
						</div>
					</div>
				</div>
			</header>

			<?php if ( has_post_thumbnail() ) : ?>
				<div class="sb-capa">
					<figure><?php the_post_thumbnail( 'sal-capa', array( 'fetchpriority' => 'high', 'decoding' => 'async' ) ); ?></figure>
				</div>
			<?php endif; ?>

			<div class="sb-conteudo">
				<?php the_content(); ?>
			</div>

			<div class="sb-bio">
				<div>
					<p class="sb-olho"><?php esc_html_e( 'Escrito por', 'sal' ); ?></p>
					<p><b>Marcelo Freitas</b> · <?php esc_html_e( 'Fundador da SAL Estratégias de Marketing. Trabalha com marketing desde 2014, com foco em tráfego pago, SEO e crescimento de lojas e negócios locais. Sede em Porto Alegre, atendimento no Brasil todo.', 'sal' ); ?></p>
					<div class="sb-links">
						<a href="https://www.linkedin.com/in/mcfreitas/" rel="noopener">LinkedIn</a>
						<a href="https://www.instagram.com/salestrategias/" rel="noopener">Instagram</a>
						<a href="https://marcelofreitas.substack.com/" rel="noopener">Newsletter</a>
					</div>
				</div>
			</div>

			<div class="sb-artigo-cta">
				<div>
					<h2><?php echo wp_kses( __( 'Quer marketing <em>na medida certa</em> para a sua loja?', 'sal' ), array( 'em' => array() ) ); ?></h2>
					<p><?php esc_html_e( 'Diagnóstico sem custo · 30 minutos, online · direto com quem faz', 'sal' ); ?></p>
					<a class="sb-pill" href="<?php echo esc_url( sal_blog_cta_url() ); ?>"><?php esc_html_e( 'Agendar diagnóstico →', 'sal' ); ?></a>
				</div>
			</div>

		</article>

		<?php
		$sal_rel = get_posts( array(
			'numberposts' => 3,
			'exclude'     => array( $sal_post->ID ),
			'category'    => $sal_cat ? $sal_cat->term_id : 0,
		) );
		if ( count( $sal_rel ) < 3 ) {
			$sal_rel = get_posts( array( 'numberposts' => 3, 'exclude' => array( $sal_post->ID ) ) );
		}
		?>
		<?php if ( $sal_rel ) : ?>
		<section class="sb-rel">
			<div class="sb-wrap">
				<h2 class="sb-rotulo"><?php esc_html_e( 'Continue lendo', 'sal' ); ?></h2>
				<div class="sb-cards">
					<?php foreach ( $sal_rel as $r ) { sal_blog_card( $r ); } ?>
				</div>
			</div>
		</section>
		<?php endif; ?>

	<?php endwhile; ?>
</main>

<?php get_footer( 'blog' ); ?>
