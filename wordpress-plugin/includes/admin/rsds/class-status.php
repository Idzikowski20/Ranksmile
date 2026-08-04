<?php
/**
 * Global RSDS status model.
 *
 * @package Ranksmile
 */

namespace Ranksmile\Admin\RSDS;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Canonical statuses: connected|disconnected|syncing|warning|error|disabled
 */
class Status {

	const CONNECTED    = 'connected';
	const DISCONNECTED = 'disconnected';
	const SYNCING      = 'syncing';
	const WARNING      = 'warning';
	const ERROR        = 'error';
	const DISABLED     = 'disabled';

	/**
	 * @param string               $status Status key.
	 * @param array<string,string> $args   title, description, action_label, action_url.
	 * @return array<string,string>
	 */
	public static function normalize( $status, $args = array() ) {
		$allowed = array( self::CONNECTED, self::DISCONNECTED, self::SYNCING, self::WARNING, self::ERROR, self::DISABLED );
		if ( ! in_array( $status, $allowed, true ) ) {
			$status = self::WARNING;
		}
		$defaults = array(
			'title'        => '',
			'description'  => '',
			'action_label' => '',
			'action_url'   => '',
		);
		$args           = wp_parse_args( $args, $defaults );
		$args['status'] = $status;
		return $args;
	}

	/**
	 * @param string               $status Status.
	 * @param array<string,string> $args   Args.
	 * @return string
	 */
	public static function render( $status, $args = array() ) {
		$data = self::normalize( $status, $args );
		ob_start();
		?>
		<div class="rs-status rs-status--<?php echo esc_attr( $data['status'] ); ?>">
			<span class="rs-status__dot" aria-hidden="true"></span>
			<div>
				<p class="rs-status__title"><?php echo esc_html( $data['title'] ); ?></p>
				<?php if ( $data['description'] ) : ?>
					<p class="rs-status__desc"><?php echo esc_html( $data['description'] ); ?></p>
				<?php endif; ?>
				<?php if ( $data['action_label'] && $data['action_url'] ) : ?>
					<div class="rs-status__action">
						<a class="rs-btn rs-btn--secondary rs-btn--sm" href="<?php echo esc_url( $data['action_url'] ); ?>"><?php echo esc_html( $data['action_label'] ); ?></a>
					</div>
				<?php endif; ?>
			</div>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * @return array<string,string>
	 */
	public static function for_api() {
		$key = get_option( 'ranksmile_api_access_key', false );
		$connected = (bool) $key && \Ranksmile()->get_plugin()->is_ranksmile_connected();
		if ( $connected ) {
			return self::normalize(
				self::CONNECTED,
				array(
					'title'       => __( 'Ranksmile API connected', 'ranksmileseo' ),
					'description' => __( 'Your WordPress site can sync with Ranksmile.', 'ranksmileseo' ),
				)
			);
		}
		return self::normalize(
			self::DISCONNECTED,
			array(
				'title'        => __( 'Ranksmile API disconnected', 'ranksmileseo' ),
				'description'  => __( 'Connect the plugin to publish and sync content.', 'ranksmileseo' ),
				'action_label' => __( 'Connect', 'ranksmileseo' ),
				'action_url'   => admin_url( 'admin.php?page=ranksmile-settings' ),
			)
		);
	}

	/**
	 * @return array<string,string>
	 */
	public static function for_gsc() {
		$ok = \Ranksmile()->get_plugin()->get_gsc()->check_if_gsc_connected();
		if ( $ok ) {
			return self::normalize(
				self::CONNECTED,
				array(
					'title'       => __( 'Google Search Console connected', 'ranksmileseo' ),
					'description' => __( 'Performance data can sync into WordPress.', 'ranksmileseo' ),
				)
			);
		}
		return self::normalize(
			self::DISCONNECTED,
			array(
				'title'        => __( 'Google Search Console not connected', 'ranksmileseo' ),
				'description'  => __( 'Connect GSC to see traffic and position insights.', 'ranksmileseo' ),
				'action_label' => __( 'Connect account', 'ranksmileseo' ),
				'action_url'   => admin_url( 'admin.php?page=ranksmile-gsc' ),
			)
		);
	}
}
