# 📐 Resumen del Proyecto: Designer (Diseño 3D Modular)

## 1. Misión y Propuesta de Valor (PV)

El proyecto "Designer" es una herramienta de **diseño 3D modular** multiplataforma (móvil y web), enfocada inicialmente en la creación rápida y estandarizada de **amoblamientos de cocina**.

### Propuesta de Valor Central (Diferenciador de Negocio)

El principal valor reside en **acelerar notablemente el proceso de diseño**, lo que genera un triple impacto:

* **Mayor Eficiencia:** Reduce el tiempo de diseño al utilizar módulos predefinidos.
* **Reducción de Costos:** Permite que la tarea sea realizada por **personal menos especializado**, ya que elimina la necesidad de conocimientos avanzados en modelado 3D para diseños estándar.
* **Aceleración de Ventas:** Los prospectos ven resultados más rápido, lo que podría reducir el tiempo de confirmación de proyectos.
* **Mejora en tasa de ventas:** Al tener un feedback visual más rápido, los prospectos podrían estar más proclives a confirmar el proyecto.



---

## 2. Pila Tecnológica (Stack) y Arquitectura

El proyecto utiliza una arquitectura desacoplada de alto rendimiento (API REST):

| Componente | Tecnología | Rol Principal |
| :--- | :--- | :--- |
| **Frontend (Cliente)** | **React Native** (Expo, TypeScript) | Interfaz de diseño y lógica 3D. |
| **Renderizado 3D** | **@react-three/fiber + three.js** | Motor de visualización e interacción 3D de alto rendimiento. |
| **Backend (API)** | **ASP.NET Core (C#)** | Servir el catálogo de módulos y gestionar la persistencia de diseños. |

### Multiplataforma

La capacidad de funcionamiento en **celulares** es crucial para el flujo de ventas:

* **Demostración al Cliente:** Mostrar el diseño y sus variantes a los clientes en sus propios dispositivos o en el celular del diseñador, incluso fuera de un local comercial.
* **Retoques en Tiempo Real:** Realizar modificaciones rápidas y visualizarlas al instante frente al cliente, mejorando la experiencia de compra.

---

## 3. Funcionalidad Clave y Flujo de Interacción

### A. Diseño, Datos y Exportación

* **Diseño Asistido y Estándar:** Uso exclusivo de módulos prefabricados del catálogo de la empresa.
* **Cálculo de Costos:** Función integrada para calcular el **costo estimado del proyecto en tiempo real** (basado en módulos y materiales).
* **Modelo de Posición:** Utiliza un **Modelo de Posición Absoluta (XYZ)** para almacenar la ubicación de los módulos, garantizando la flexibilidad para estructuras complejas como por ejemplo: cocinas con islas, racks de TV con elementos superpuestos (Si bien en un principio el diseño de racks de TV no son parte del proyecto, se considera como un posible agregado a futuro).
* **Exportación 3D:** Capacidad de exportar el **modelo 3D completo** del diseño para que pueda ser importado en otros programas de modelado 3D para agregar detalles o ampliar el diseño.

### B. Interacción del Diseñador (UX)

La colocación de muebles se optimiza mediante interacciones asistidas y precisas:

1.  **Colocación Rápida:** Al seleccionar un módulo, aparecen **botones flotantes ("+") dentro de la escena 3D** en los espacios lógicos disponibles, permitiendo una colocación instantánea y guiada.
2.  **Ajuste Preciso:** Para desplazar un mueble ya colocado, el usuario accede a un **panel flotante** que permite introducir la distancia y la dirección exactas del movimiento, asegurando la precisión dimensional requerida en la carpintería.