<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
use Ranksmile\Admin\RSDS\Status;
$gsc = Status::for_gsc();
$connected = Status::CONNECTED === $gsc['status'];
?>
<div class="rs-card" style="margin-bottom:var(--rs-space-6);"><div class="rs-card__body">
<?php echo Status::render( $gsc['status'], $gsc ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
</div></div>
<?php if ( $connected ) : ?>
	<div class="rs-card"><div class="rs-card__body">
		<p><?php esc_html_e( 'View the Performance Report for detailed Search Console metrics.', 'ranksmileseo' ); ?></p>
		<a class="rs-btn rs-btn--primary" href="<?php echo esc_url( admin_url( 'admin.php?page=ranksmile-performance-report' ) ); ?>"><?php esc_html_e( 'Open Performance Report', 'ranksmileseo' ); ?></a>
	</div></div>
<?php else : ?>
	<div class="rs-empty">
		<h2 class="rs-empty__title"><?php esc_html_e( 'Google Search Console not connected', 'ranksmileseo' ); ?></h2>
		<p class="rs-empty__desc"><?php esc_html_e( 'Connect your Search Console property to unlock traffic and position insights.', 'ranksmileseo' ); ?></p>
		<a class="rs-btn rs-btn--primary" href="<?php echo esc_url( admin_url( 'admin.php?page=ranksmile-settings' ) ); ?>"><?php esc_html_e( 'Connect account', 'ranksmileseo' ); ?></a>
	</div>
<?php endif; ?>
