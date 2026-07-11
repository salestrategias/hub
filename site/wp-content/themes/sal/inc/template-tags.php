<?php
/**
 * Helpers de exibição usados pelos templates.
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Logo: imagem enviada no Personalizar ou o wordmark "SAL." em texto.
 */
function sal_logo(): void {
	if ( has_custom_logo() ) {
		the_custom_logo();
		return;
	}
	printf(
		'<a class="logo" href="%s" rel="home">SAL<span class="logo__ponto">.</span></a>',
		esc_url( home_url( '/' ) )
	);
}

/**
 * URL do CTA principal: aceita caminho relativo ("/diagnostico/") ou URL completa.
 */
function sal_cta_url(): string {
	$url = sal_mod( 'sal_cta_url' );
	if ( $url && ! preg_match( '#^https?://#i', $url ) ) {
		$url = home_url( $url );
	}
	return $url ?: home_url( '/diagnostico/' );
}

/**
 * Link do WhatsApp a partir do número salvo (só dígitos). Vazio = sem botão.
 */
function sal_whatsapp_url(): string {
	$numero = preg_replace( '/\D/', '', sal_mod( 'sal_whatsapp' ) );
	return $numero ? 'https://wa.me/' . $numero : '';
}

/**
 * Card de post (usado na home, arquivo e busca).
 */
function sal_card_post(): void {
	?>
	<article class="card-post">
		<?php if ( has_post_thumbnail() ) : ?>
			<a class="card-post__capa" href="<?php the_permalink(); ?>" tabindex="-1" aria-hidden="true">
				<?php the_post_thumbnail( 'sal-card', array( 'loading' => 'lazy' ) ); ?>
			</a>
		<?php endif; ?>
		<div class="card-post__corpo">
			<div class="card-post__meta">
				<?php
				$categoria = get_the_category();
				if ( $categoria ) {
					echo '<span class="tag">' . esc_html( $categoria[0]->name ) . '</span>';
				}
				?>
				<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time>
			</div>
			<h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
			<p><?php echo esc_html( get_the_excerpt() ); ?></p>
		</div>
	</article>
	<?php
}

/**
 * Menu padrão enquanto nenhum menu é atribuído no painel:
 * âncoras das seções da home + blog.
 */
function sal_menu_padrao(): void {
	$home = esc_url( home_url( '/' ) );
	echo '<ul>';
	echo '<li><a href="' . $home . '#quem-atendemos">' . esc_html__( 'Quem atendemos', 'sal' ) . '</a></li>';
	echo '<li><a href="' . $home . '#servicos">' . esc_html__( 'Serviços', 'sal' ) . '</a></li>';
	echo '<li><a href="' . $home . '#metodo">' . esc_html__( 'Método', 'sal' ) . '</a></li>';
	echo '<li><a href="' . $home . 'blog/">' . esc_html__( 'Blog', 'sal' ) . '</a></li>';
	echo '</ul>';
}

/**
 * Paginação de arquivos com marcação acessível.
 */
function sal_paginacao(): void {
	$links = paginate_links( array(
		'mid_size'  => 1,
		'prev_text' => __( '← Anteriores', 'sal' ),
		'next_text' => __( 'Próximos →', 'sal' ),
		'type'      => 'plain',
	) );
	if ( $links ) {
		echo '<nav class="paginacao" aria-label="' . esc_attr__( 'Paginação', 'sal' ) . '">' . $links . '</nav>'; // phpcs:ignore WordPress.Security.EscapeOutput -- paginate_links já retorna HTML seguro.
	}
}
