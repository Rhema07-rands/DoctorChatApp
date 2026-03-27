import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

interface Props { label: string; data: string[]; onSelect: (item: string) => void; selectedVal: string; }

export default function CustomDropdown({ label, data, onSelect, selectedVal }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setVisible(true)}>
        <Text style={{ color: selectedVal ? '#000' : '#6B7280' }}>{selectedVal || label}</Text>
        <Text>⌄</Text>
      </TouchableOpacity>

      <Modal transparent visible={visible} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <View style={styles.menu}>
              <FlatList
                data={data}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.item} onPress={() => { onSelect(item); setVisible(false); }}>
                    <Text>{item}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(i) => i}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, backgroundColor: '#fff', marginBottom: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menu: { width: '80%', backgroundColor: 'white', borderRadius: 8, maxHeight: 300, padding: 10 },
  item: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }
});