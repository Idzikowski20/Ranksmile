<?php
/**
 * Plugin Health score for Dashboard.
 *
 * @package Ranksmile
 */

namespace Ranksmile\Admin\RSDS;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Overall health %.
 */
class Health {

	/**
	 * @return array{score:int,items:array<int,array{ok:bool,label:string}>,synced_articles:int}
	 */
	public static function summary() {
		$api    = Status::for_api();
		$gsc    = Status::for_gsc();
		$synced = self::synced_article_count();
		$items  = array(
			array(
				'ok'    => Status::CONNECTED === $api['status'],
				'label' => Status::CONNECTED === $api['status']
					? __( 'API Connected', 'ranksmileseo' )
					: __( 'API Disconnected', 'ranksmileseo' ),
			),
			array(
				'ok'    => Status::CONNECTED === $gsc['status'],
				'label' => Status::CONNECTED === $gsc['status']
					? __( 'GSC Connected', 'ranksmileseo' )
					: __( 'GSC Not connected', 'ranksmileseo' ),
			),
			array(
				'ok'    => $synced > 0,
				'label' => $synced > 0
					? sprintf( __( '%d articles synced', 'ranksmileseo' ), $synced )
					: __( 'No articles synced yet', 'ranksmileseo' ),
			),
			array(
				'ok'    => true,
				'label' => sprintf( __( 'Plugin %s', 'ranksmileseo' ), RANKSMILE_VERSION ),
			),
		);
		$ok = 0;
		foreach ( $items as $item ) {
			if ( $item['ok'] ) {
				++$ok;
			}
		}
		return array(
			'score'            => (int) round( ( $ok / max( count( $items ), 1 ) ) * 100 ),
			'items'            => $items,
			'synced_articles'  => $synced,
		);
	}

	/**
	 * @return int
	 */
	public static function synced_article_count() {
		global $wpdb;
		$sql = "SELECT COUNT(DISTINCT post_id) FROM {$wpdb->postmeta} WHERE meta_key = 'ranksmile_draft_id' AND meta_value <> ''";
		return (int) $wpdb->get_var( $sql );
	}
}
