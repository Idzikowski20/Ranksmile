<?php
/**
 * Dashboard — connect wizard when disconnected; account status when connected.
 *
 * @package Ranksmile
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$connected     = Ranksmile()->get_plugin()->is_ranksmile_connected();
$gsc_connected = Ranksmile()->get_plugin()->get_gsc()->check_if_gsc_connected( true );
$details       = Ranksmile()->get_plugin()->wp_connection_details();
$app_url       = Ranksmile()->get_plugin()->get_ranksmile_url();
$current_user  = wp_get_current_user();
?>
<input type="hidden" id="ranksmile-auth-user" value="<?php echo esc_attr( (string) $current_user->ID ); ?>" />

<?php /* Disconnected: wizard + Connect CTA. Connected block kept for connector.js after connect. */ ?>
<div class="ranksmile-not-connected"<?php echo $connected ? ' style="display:none"' : ''; ?>>
	<div class="rs-connect-wizard">
		<div class="rs-connect-wizard__card">
			<img class="rs-connect-wizard__logo" src="<?php echo esc_url( Ranksmile()->get_baseurl() . 'assets/images/ranksmile_logo.svg' ); ?>" alt="" width="36" height="36" />
			<ol class="rs-connect-wizard__steps" aria-label="<?php esc_attr_e( 'Setup steps', 'ranksmileseo' ); ?>">
				<li class="rs-connect-wizard__step is-active">
					<span class="rs-connect-wizard__step-dot" aria-hidden="true">1</span>
					<span class="rs-connect-wizard__step-label"><?php esc_html_e( 'Connect Ranksmile', 'ranksmileseo' ); ?></span>
				</li>
				<li class="rs-connect-wizard__step">
					<span class="rs-connect-wizard__step-dot" aria-hidden="true">2</span>
					<span class="rs-connect-wizard__step-label"><?php esc_html_e( 'Search Console', 'ranksmileseo' ); ?></span>
				</li>
				<li class="rs-connect-wizard__step">
					<span class="rs-connect-wizard__step-dot" aria-hidden="true">3</span>
					<span class="rs-connect-wizard__step-label"><?php esc_html_e( 'Ready', 'ranksmileseo' ); ?></span>
				</li>
			</ol>
			<h2 class="rs-connect-wizard__title"><?php esc_html_e( 'Connect WordPress to Ranksmile', 'ranksmileseo' ); ?></h2>
			<p class="rs-connect-wizard__desc">
				<?php esc_html_e( 'Link this site so you can publish and sync articles between Ranksmile and WordPress. Takes about a minute.', 'ranksmileseo' ); ?>
			</p>
			<div class="rs-connect-wizard__actions">
				<button type="button" class="rs-btn rs-btn--primary ranksmile_make_connection">
					<?php esc_html_e( 'Connect to Ranksmile', 'ranksmileseo' ); ?>
				</button>
				<?php ranksmile_image_printer( esc_url( includes_url() ) . 'images/spinner.gif', 'spinner', 'display: none', 'ranksmile-connection-spinner' ); ?>
			</div>
		</div>
	</div>
</div>

<?php /* Connected: same info as before — status, via email, disconnect / replace, GSC. */ ?>
<div class="ranksmile-connected"<?php echo $connected ? '' : ' style="display:none"'; ?>>
	<section class="rs-settings-section">
		<h2 class="rs-settings-section__title"><?php esc_html_e( 'Ranksmile account', 'ranksmileseo' ); ?></h2>
		<div class="rs-settings-section__body">
			<p class="rs-settings-row__desc">
				<?php esc_html_e( 'Connect your Ranksmile account to easily optimize your posts with Content Editor', 'ranksmileseo' ); ?>
			</p>
			<div class="rs-status rs-status--connected">
				<span class="rs-status__dot" aria-hidden="true"></span>
				<div>
					<p class="rs-status__title"><?php esc_html_e( 'Connected', 'ranksmileseo' ); ?></p>
					<p class="rs-status__desc rs-connection-details">
						<span id="ranksmile-organization-name"><?php echo isset( $details['organization_name'] ) ? esc_html( $details['organization_name'] ) : ''; ?></span>
						<?php esc_html_e( 'via', 'ranksmileseo' ); ?>
						<span id="ranksmile-via-email"><?php echo isset( $details['via_email'] ) ? esc_html( $details['via_email'] ) : ''; ?></span>
					</p>
					<div class="rs-status__action" style="display:flex;flex-wrap:wrap;gap:8px;">
						<button type="button" class="rs-btn rs-btn--secondary rs-btn--sm" id="ranksmile_disconnect"><?php esc_html_e( 'Disconnect', 'ranksmileseo' ); ?></button>
						<button type="button" class="rs-btn rs-btn--secondary rs-btn--sm" id="ranksmile_reconnect"><?php esc_html_e( 'Replace with another Ranksmile account', 'ranksmileseo' ); ?></button>
						<?php ranksmile_image_printer( esc_url( includes_url() ) . 'images/spinner.gif', 'spinner', 'display: none', 'ranksmile-reconnection-spinner' ); ?>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="rs-settings-section">
		<h2 class="rs-settings-section__title"><?php esc_html_e( 'Google Search Console integration', 'ranksmileseo' ); ?></h2>
		<div class="rs-settings-section__body">
			<p class="rs-settings-row__desc">
				<?php esc_html_e( 'Connect Google Search Console to track clicks and impressions on your posts', 'ranksmileseo' ); ?>
			</p>
			<?php if ( $gsc_connected ) : ?>
				<div class="rs-status rs-status--connected">
					<span class="rs-status__dot" aria-hidden="true"></span>
					<div>
						<p class="rs-status__title"><?php esc_html_e( 'Connected', 'ranksmileseo' ); ?></p>
						<div class="rs-status__action">
							<a class="rs-btn rs-btn--secondary rs-btn--sm" href="<?php echo esc_url( $app_url . '/settings/google_search_console' ); ?>" target="_blank" rel="noopener noreferrer">
								<?php esc_html_e( 'Edit GSC integration inside Ranksmile', 'ranksmileseo' ); ?>
							</a>
						</div>
					</div>
				</div>
			<?php else : ?>
				<div class="rs-status rs-status--disconnected">
					<span class="rs-status__dot" aria-hidden="true"></span>
					<div>
						<p class="rs-status__title"><?php esc_html_e( 'Not connected', 'ranksmileseo' ); ?></p>
						<p class="rs-status__desc"><?php esc_html_e( 'Optional — add GSC in Ranksmile to see traffic in WordPress.', 'ranksmileseo' ); ?></p>
						<div class="rs-status__action">
							<a class="rs-btn rs-btn--primary rs-btn--sm" href="<?php echo esc_url( $app_url . '/api/gsc/connect?redirect=/settings/google_search_console' ); ?>" target="_blank" rel="noopener noreferrer">
								<?php esc_html_e( 'Add GSC account to Ranksmile', 'ranksmileseo' ); ?>
							</a>
						</div>
					</div>
				</div>
			<?php endif; ?>
		</div>
	</section>
</div>
