<?php
/**
 * Artigo. Cabeçalho escuro, leitura sobre a folha clara.
 * A estrutura é a que Google, Discover e IAs esperam: um h1, data de
 * publicação e de atualização visíveis, autor identificado e resumo no topo.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header();

while ( have_posts() ) : the_post();
	$cat        = sal_categoria();
	$capa       = get_the_post_thumbnail_url( null, 'full' );
	$atualizado = get_the_modified_date( 'U' ) - get_the_date( 'U' ) > DAY_IN_SECONDS;
	$resumo     = has_excerpt() ? get_the_excerpt() : '';
?>

<main id="conteudo">

	<article class="artigo">

		<header class="artigo-topo">
			<div class="wrap wrap-texto">
				<nav class="migalha" aria-label="Você está em">
					<a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">Blog</a>
					<?php if ( $cat ) : ?> › <a href="<?php echo esc_url( get_category_link( $cat ) ); ?>"><?php echo esc_html( $cat->name ); ?></a><?php endif; ?>
				</nav>
				<h1><?php the_title(); ?></h1>
				<?php if ( $resumo ) : ?><p class="dek"><?php echo esc_html( $resumo ); ?></p><?php endif; ?>
				<div class="meta">
					<img class="meta-foto" src="/img/fotos/marcelo-palestra.webp" alt="" width="40" height="40" loading="lazy">
					<span>
						Por <a href="/marcelo-freitas/">Marcelo Freitas</a> ·
						<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( sal_data() ); ?></time>
						<?php if ( $atualizado ) : ?> · atualizado em <time datetime="<?php echo esc_attr( get_the_modified_date( 'c' ) ); ?>"><?php echo esc_html( get_the_modified_date( 'j \d\e F \d\e Y' ) ); ?></time><?php endif; ?>
						· <?php echo (int) sal_leitura(); ?> min de leitura
					</span>
				</div>
			</div>
		</header>

		<?php if ( $capa ) : ?>
		<figure class="artigo-capa">
			<div class="wrap"><img src="<?php echo esc_url( $capa ); ?>" alt="<?php echo esc_attr( get_the_title() ); ?>" width="1200" height="675" fetchpriority="high" decoding="async"></div>
		</figure>
		<?php endif; ?>

		<div class="folha">
			<div class="wrap wrap-texto conteudo">
				<?php the_content(); ?>
			</div>
		</div>

		<footer class="artigo-pe">
			<div class="wrap wrap-texto">

				<div class="autor">
					<img src="/img/fotos/marcelo-palestra.webp" alt="Marcelo Freitas" width="72" height="72" loading="lazy">
					<div>
						<strong>Marcelo Freitas</strong>
						<p>Fundador da SAL Estratégias de Marketing. Estrategista de marketing há 12 anos, cinco deles no universo de shopping center, respondendo pelo movimento de dezenas de lojas ao mesmo tempo.</p>
						<nav class="autor-links" aria-label="Perfis de Marcelo Freitas">
							<a href="/marcelo-freitas/">Perfil completo</a>
							<a href="https://www.linkedin.com/in/mcfreitas/" rel="noopener" target="_blank">LinkedIn</a>
							<a href="https://marcelofreitas.substack.com/" rel="noopener" target="_blank">Newsletter</a>
						</nav>
					</div>
				</div>

				<nav class="vizinhos" aria-label="Mais artigos">
					<?php $ant = get_previous_post(); $prox = get_next_post(); ?>
					<?php if ( $ant ) : ?><a class="vizinho" rel="prev" href="<?php echo esc_url( get_permalink( $ant ) ); ?>"><span>← Anterior</span><?php echo esc_html( get_the_title( $ant ) ); ?></a><?php endif; ?>
					<?php if ( $prox ) : ?><a class="vizinho vizinho-dir" rel="next" href="<?php echo esc_url( get_permalink( $prox ) ); ?>"><span>Próximo →</span><?php echo esc_html( get_the_title( $prox ) ); ?></a><?php endif; ?>
				</nav>

			</div>
		</footer>

	</article>

	<?php
	$rel = $cat ? get_posts( array( 'numberposts' => 3, 'category' => $cat->term_id, 'post__not_in' => array( get_the_ID() ) ) ) : array();
	if ( $rel ) :
	?>
	<section class="faixa">
		<div class="wrap">
			<h2 class="rotulo">Continue lendo</h2>
			<div class="grade">
				<?php foreach ( $rel as $p ) { get_template_part( 'parts/card', null, array( 'post' => $p ) ); } ?>
			</div>
		</div>
	</section>
	<?php endif; ?>

</main>

<?php
endwhile;
get_footer();
