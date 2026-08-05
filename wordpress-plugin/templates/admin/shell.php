<?php
/**
 * RSDS Admin Shell — Ranksmile app Settings layout (sidebar + main).
 *
 * Expected vars: $rs_page_slug, $rs_page_title, $rs_page_description,
 * $rs_primary_action (array label/url|null), $rs_secondary_action, $rs_content_template
 *
 * @package Ranksmile
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Ranksmile\Admin\RSDS\Nav;
use Ranksmile\Admin\RSDS\Notices;

$rs_page_slug        = isset( $rs_page_slug ) ? $rs_page_slug : 'ranksmile';
$rs_page_title       = isset( $rs_page_title ) ? $rs_page_title : 'Ranksmile';
$rs_page_description = isset( $rs_page_description ) ? $rs_page_description : '';
$rs_primary_action   = isset( $rs_primary_action ) ? $rs_primary_action : null;
$rs_secondary_action = isset( $rs_secondary_action ) ? $rs_secondary_action : null;
$rs_settings_section = isset( $_GET['section'] ) ? sanitize_key( wp_unslash( $_GET['section'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
?>
<div class="wrap ranksmile-admin" data-theme="light">
	<div class="rs-settings-shell">
		<aside class="rs-settings-nav" aria-label="<?php esc_attr_e( 'Ranksmile', 'ranksmileseo' ); ?>">
			<div class="rs-settings-nav__scroll">
				<?php echo Nav::render( $rs_page_slug, $rs_settings_section ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			</div>
		</aside>
		<div class="rs-settings-main">
			<header class="rs-settings-header">
				<div class="rs-settings-header__row">
					<div class="rs-settings-header__copy">
						<h1 class="rs-settings-header__title"><?php echo esc_html( $rs_page_title ); ?></h1>
						<?php if ( $rs_page_description ) : ?>
							<p class="rs-settings-header__subtitle"><?php echo esc_html( $rs_page_description ); ?></p>
						<?php endif; ?>
					</div>
					<?php if ( ( is_array( $rs_primary_action ) && ! empty( $rs_primary_action['url'] ) ) || ( is_array( $rs_secondary_action ) && ! empty( $rs_secondary_action['url'] ) ) ) : ?>
						<div class="rs-settings-header__actions">
							<?php if ( is_array( $rs_secondary_action ) && ! empty( $rs_secondary_action['url'] ) ) : ?>
								<a class="rs-btn rs-btn--secondary rs-btn--sm" href="<?php echo esc_url( $rs_secondary_action['url'] ); ?>"><?php echo esc_html( $rs_secondary_action['label'] ); ?></a>
							<?php endif; ?>
							<?php if ( is_array( $rs_primary_action ) && ! empty( $rs_primary_action['url'] ) ) : ?>
								<a class="rs-btn rs-btn--primary rs-btn--sm" href="<?php echo esc_url( $rs_primary_action['url'] ); ?>"><?php echo esc_html( $rs_primary_action['label'] ); ?></a>
							<?php endif; ?>
						</div>
					<?php endif; ?>
				</div>
			</header>
			<div class="rs-settings-body">
				<?php echo Notices::render(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				<?php
				if ( ! empty( $rs_content_template ) && file_exists( $rs_content_template ) ) {
					require $rs_content_template;
				}
				?>
			</div>
		</div>
	</div>
</div>
