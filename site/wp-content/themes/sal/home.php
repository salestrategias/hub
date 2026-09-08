<?php
/**
 * O portal do blog (/blog/): manchete, últimas, editorias, guias e newsletter.
 *
 * @package sal
 */

$recentes = get_posts( array( 'numberposts' => 9 ) );
$manchete = $recentes ? array_shift( $recentes ) : null;
$ultimas  = $recentes;

get_header( 'blog' );
?>

<main id="conteudo">

	<?php if ( $manchete ) : ?>
	<section class="sb-manchete">
		<div class="sb-wrap">
			<div>
				<h1 class="sb-blog-titulo"><?php esc_html_e( 'Blog da SAL', 'sal' ); ?><span><?php esc_html_e( 'Marketing, varejo e e-commerce, sem enrolação.', 'sal' ); ?></span></h1>
				<div class="sb-olho">
					<span class="sb-cat"><?php esc_html_e( 'Em destaque', 'sal' ); ?></span>
					<span class="sb-grao" aria-hidden="true"></span>
					<?php $mcat = sal_blog_categoria( $manchete ); ?>
					<?php if ( $mcat ) : ?><span class="sb-cat"><?php echo esc_html( $mcat->name ); ?></span><?php endif; ?>
				</div>
				<h2><a href="<?php echo esc_url( get_permalink( $manchete ) ); ?>"><?php echo esc_html( get_the_title( $manchete ) ); ?></a></h2>
				<p class="sb-dek"><?php echo esc_html( sal_blog_resumo( $manchete, 34 ) ); ?></p>
				<div class="sb-meta">
					<span>Marcelo Freitas</span>
					<span class="sb-grao" aria-hidden="true" style="width:5px;height:5px"></span>
					<time datetime="<?php echo esc_attr( get_the_date( 'c', $manchete ) ); ?>"><?php echo esc_html( sal_blog_data( $manchete ) ); ?></time>
				</div>
				<div class="sb-acoes">
					<a class="sb-pill" href="<?php echo esc_url( get_permalink( $manchete ) ); ?>"><?php esc_html_e( 'Ler agora →', 'sal' ); ?></a>
					<a class="sb-pill sb-pill--vazada" href="#ultimas"><?php esc_html_e( 'Todas as últimas', 'sal' ); ?></a>
				</div>
			</div>
			<a href="<?php echo esc_url( get_permalink( $manchete ) ); ?>" aria-label="<?php echo esc_attr( get_the_title( $manchete ) ); ?>">
				<figure>
					<span class="sb-selo"><?php esc_html_e( 'EM DESTAQUE', 'sal' ); ?></span>
					<?php echo get_the_post_thumbnail( $manchete, 'sal-capa', array( 'fetchpriority' => 'high', 'decoding' => 'async' ) ); ?>
				</figure>
			</a>
		</div>
	</section>
	<?php endif; ?>

	<?php if ( $ultimas ) : ?>
	<div class="sb-agora">
		<div class="sb-wrap">
			<span class="sb-lbl"><span class="sb-grao" aria-hidden="true"></span> <?php esc_html_e( 'AGORA NO VAREJO', 'sal' ); ?></span>
			<ul tabindex="0" aria-label="<?php esc_attr_e( 'Últimas publicações', 'sal' ); ?>">
				<?php foreach ( array_slice( $ultimas, 0, 3 ) as $p ) : ?>
					<li><span class="sb-grao" aria-hidden="true" style="width:5px;height:5px"></span><a href="<?php echo esc_url( get_permalink( $p ) ); ?>"><?php echo esc_html( get_the_title( $p ) ); ?></a></li>
				<?php endforeach; ?>
			</ul>
		</div>
	</div>

	<section class="sb-sec" id="ultimas">
		<div class="sb-wrap">
			<h2 class="sb-rotulo"><?php esc_html_e( 'Últimas', 'sal' ); ?></h2>
			<div class="sb-cards">
				<?php foreach ( $ultimas as $p ) { sal_blog_card( $p ); } ?>
			</div>
		</div>
	</section>
	<?php endif; ?>

	<section>
		<div class="sb-wrap"><h2 class="sb-rotulo"><?php esc_html_e( 'Editorias', 'sal' ); ?></h2></div>
		<?php foreach ( sal_blog_editorias() as $ed ) :
			$lote = get_posts( array( 'numberposts' => 4, 'category' => $ed->term_id ) );
			if ( ! $lote ) {
				continue;
			}
			$topo = array_shift( $lote );
		?>
		<div class="sb-editoria">
			<div class="sb-wrap">
				<div class="sb-ed-cabeca">
					<h3><span class="sb-grao" aria-hidden="true"></span><?php echo esc_html( $ed->name ); ?></h3>
					<a href="<?php echo esc_url( get_category_link( $ed ) ); ?>"><?php esc_html_e( 'Ver editoria →', 'sal' ); ?></a>
				</div>
				<div class="sb-ed-grade">
					<a class="sb-ed-destaque" href="<?php echo esc_url( get_permalink( $topo ) ); ?>">
						<figure><?php echo get_the_post_thumbnail( $topo, 'sal-card', array( 'loading' => 'lazy', 'decoding' => 'async' ) ); ?></figure>
						<div>
							<span class="sb-cat"><?php esc_html_e( 'Destaque', 'sal' ); ?></span>
							<h4><?php echo esc_html( get_the_title( $topo ) ); ?></h4>
							<p><?php echo esc_html( sal_blog_resumo( $topo, 20 ) ); ?></p>
						</div>
					</a>
					<ul class="sb-ed-lista">
						<?php $i = 2; foreach ( $lote as $p ) : ?>
						<li>
							<a href="<?php echo esc_url( get_permalink( $p ) ); ?>">
								<span class="sb-num"><?php echo esc_html( str_pad( (string) $i++, 2, '0', STR_PAD_LEFT ) ); ?></span>
								<h4><?php echo esc_html( get_the_title( $p ) ); ?></h4>
							</a>
						</li>
						<?php endforeach; ?>
					</ul>
				</div>
			</div>
		</div>
		<?php endforeach; ?>
	</section>

	<?php $guias = sal_blog_guias(); ?>
	<?php if ( $guias ) : ?>
	<section class="sb-guias">
		<div class="sb-wrap">
			<div class="sb-rotulo"><?php esc_html_e( 'Guias essenciais', 'sal' ); ?></div>
			<h2 class="sb-tit"><?php esc_html_e( 'Comece por aqui.', 'sal' ); ?></h2>
			<p class="sb-sub"><?php esc_html_e( 'Os artigos de fundação: a conta que protege a sua margem, o diagnóstico da loja que não vende e as bases de tráfego e SEO.', 'sal' ); ?></p>
			<ol>
				<?php $i = 1; foreach ( $guias as $g ) : ?>
				<li>
					<a href="<?php echo esc_url( get_permalink( $g ) ); ?>">
						<span class="sb-num"><?php echo esc_html( str_pad( (string) $i++, 2, '0', STR_PAD_LEFT ) ); ?></span>
						<h3><?php echo esc_html( get_the_title( $g ) ); ?></h3>
					</a>
				</li>
				<?php endforeach; ?>
			</ol>
		</div>
	</section>
	<?php endif; ?>

	<section class="sb-fim">
		<div class="sb-wrap">
			<div class="sb-maislidos">
				<h2 class="sb-rotulo"><?php esc_html_e( 'Mais lidos', 'sal' ); ?></h2>
				<ol>
					<?php $i = 1; foreach ( array_slice( array_merge( $manchete ? array( $manchete ) : array(), $ultimas ), 0, 5 ) as $p ) : ?>
					<li>
						<a href="<?php echo esc_url( get_permalink( $p ) ); ?>">
							<span class="sb-num"><?php echo esc_html( (string) $i++ ); ?></span>
							<h3><?php echo esc_html( get_the_title( $p ) ); ?></h3>
						</a>
					</li>
					<?php endforeach; ?>
				</ol>
			</div>
			<aside class="sb-news">
				<h3><?php esc_html_e( 'O varejo muda toda semana. Resumimos pra você.', 'sal' ); ?></h3>
				<p><?php esc_html_e( 'Receba o essencial de tráfego, SEO e e-commerce, na medida certa. Sem spam, sem enrolação.', 'sal' ); ?></p>
				<a class="sb-pill" href="<?php echo esc_url( sal_blog_news_url( 'portal' ) ); ?>" rel="noopener"><?php esc_html_e( 'Quero receber →', 'sal' ); ?></a>
			</aside>
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
