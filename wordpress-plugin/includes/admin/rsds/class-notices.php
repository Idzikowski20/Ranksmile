<?php
/**
 * In-shell notification center.
 *
 * @package Ranksmile
 */

namespace Ranksmile\Admin\RSDS;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Queue success|warning|error|info for Admin Shell.
 */
class Notices {

	const TRANSIENT = 'ranksmile_rsds_notices';

	/**
	 * @param string $type    Type.
	 * @param string $message Message.
	 */
	public static function push( $type, $message ) {
		$allowed = array( 'success', 'warning', 'error', 'info' );
		if ( ! in_array( $type, $allowed, true ) ) {
			$type = 'info';
		}
		$user_id = get_current_user_id();
		$key     = self::TRANSIENT . '_' . $user_id;
		$queue   = get_transient( $key );
		if ( ! is_array( $queue ) ) {
			$queue = array();
		}
		$queue[] = array(
			'type'    => $type,
			'message' => $message,
		);
		set_transient( $key, $queue, MINUTE_IN_SECONDS * 5 );
	}

	/**
	 * @return array<int,array{type:string,message:string}>
	 */
	public static function pull() {
		$user_id = get_current_user_id();
		$key     = self::TRANSIENT . '_' . $user_id;
		$queue   = get_transient( $key );
		delete_transient( $key );
		return is_array( $queue ) ? $queue : array();
	}

	/**
	 * @return string
	 */
	public static function render() {
		$queue = self::pull();
		if ( ! $queue ) {
			return '';
		}
		ob_start();
		echo '<div class="rs-notice-stack" role="status">';
		foreach ( $queue as $item ) {
			$mod = in_array( $item['type'], array( 'success', 'warning', 'error', 'info' ), true ) ? $item['type'] : 'info';
			echo '<div class="rs-notice rs-notice--' . esc_attr( $mod ) . '"><div>' . esc_html( $item['message'] ) . '</div></div>';
		}
		echo '</div>';
		return (string) ob_get_clean();
	}
}
